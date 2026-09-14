/* Audit Desk — website scan.
   POST { url, city?, business? } with header x-desk-key.
   Fetches the prospect's homepage server-side (browsers can't, because of CORS)
   and returns facts about it. It never returns the page itself, and it never
   judges taste — the desk turns these facts into findings, and anything that
   needs a human eye (design quality, photography) is left for Phillip to mark. */
'use strict';

const { authorised, body, assertPublicUrl } = require('./_lib');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
           '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CAP = 2500000;          // bytes of HTML read before giving up on the rest
const BUDGET = 9000;          // ms for the whole fetch, redirects included

module.exports = async function handler(req, res) {
  if (!authorised(req, res)) return;
  const b = body(req);
  let raw = String(b.url || '').trim();
  if (!raw) return res.status(400).json({ error: 'url', message: 'No website address given.' });
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

  let start;
  try { start = new URL(raw); } catch (e) {
    return res.status(400).json({ error: 'url', message: 'That website address is not valid.' });
  }

  try {
    let page;
    try {
      page = await fetchPage(start);
    } catch (e) {
      // plenty of small-business sites still only answer on http
      const code = e.code || (e.cause && e.cause.code);
      // (not after a timeout: a second 9s wait would outlast the function)
      const slow = e.name === 'TimeoutError' || e.name === 'AbortError';
      if (start.protocol === 'https:' && !slow && code !== 'ENOTFOUND' && !/public website|ports|credentials/.test(e.message)) {
        const alt = new URL(start.href); alt.protocol = 'http:';
        page = await fetchPage(alt);
      } else throw e;
    }
    res.status(200).json(analyse(page, String(b.city || ''), String(b.business || '')));
  } catch (e) {
    const msg = e.name === 'TimeoutError' || e.name === 'AbortError'
      ? 'The site took too long to respond (over 9 seconds).'
      : (e.code || (e.cause && e.cause.code)) === 'ENOTFOUND' ? 'That domain does not resolve — check the address.'
      : e.message || 'The site could not be fetched.';
    res.status(422).json({ error: 'fetch_failed', message: msg });
  }
};

async function fetchPage(start) {
  const t0 = Date.now();
  const hops = [];
  let url = start;
  for (let i = 0; i < 6; i++) {
    await assertPublicUrl(url);
    const left = Math.max(1500, BUDGET - (Date.now() - t0));
    const r = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
                 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(left)
    });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      hops.push({ status: r.status, from: url.href });
      url = new URL(loc, url);
      continue;
    }
    const ttfb = Date.now() - t0;
    const { text, bytes, truncated } = await readCapped(r);
    return { url: url.href, status: r.status, hops, ttfb, ms: Date.now() - t0, bytes, truncated, html: text,
             contentType: r.headers.get('content-type') || '' };
  }
  throw new Error('The site redirects too many times.');
}

async function readCapped(r) {
  if (!r.body) return { text: '', bytes: 0, truncated: false };
  const reader = r.body.getReader();
  const chunks = [];
  let bytes = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    chunks.push(value);
    if (bytes > CAP) { truncated = true; try { await reader.cancel(); } catch (e) {} break; }
  }
  return { text: Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8'), bytes, truncated };
}

/* ── analysis: regex over HTML, good enough for signals ─────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', rsquo: '’', lsquo: '‘',
              ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…', reg: '®', trade: '™' };
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function clean(s) { return decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function attr(tag, name) {
  const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
}
function metaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const t of tags) {
    const n = (attr(t, 'name') || attr(t, 'property') || '').toLowerCase();
    if (n === key) return attr(t, 'content');
  }
  return null;
}
const uniq = a => [...new Set(a)];

const CTA_RE = /\b(book( now| online| an? (appointment|visit|call|consultation|table))?|schedule|reserve|appointment|(get|request)( a| an| your)?( free)? (quote|estimate|consultation|pricing)|free (quote|estimate|consultation|inspection|audit|trial|class|session)|(get|claim|book|start) (my|your) |call (us|now|today)|contact us|get started|order (online|now)|shop now|start (your|a) |buy now|enquire|inquire|claim|apply now)\b/i;
const GENERIC_H1 = /^(welcome|home|homepage|untitled|lorem ipsum|coming soon|under construction|hello|about us)\b|welcome to (our|the) (website|site)/i;

const PLATFORMS = [
  ['Wix', /wixstatic\.com|x-wix-|_wixCssImports|wix-code/i],
  ['Squarespace', /static1\.squarespace\.com|squarespace-cdn|Squarespace\./i],
  ['GoDaddy Website Builder', /img1\.wsimg\.com|godaddy website builder/i],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme/i],
  ['Webflow', /data-wf-page|webflow\.com\/css|\.webflow\.io/i],
  ['Weebly', /weebly\.com|editmysite\.com/i],
  ['Duda', /dudaone|multiscreensite|dmAlbum/i],
  ['Showit', /showit\.co|showitcdn/i],
  ['WordPress', /wp-content\/|wp-includes\//i],
  ['Framer', /framerusercontent\.com|framer\.com\/m\//i],
  ['Carrd', /carrd\.co/i]
];
const BUILDERS = [['Elementor', /elementor/i], ['Divi', /et_pb_|divi/i], ['Beaver Builder', /fl-builder/i]];
const BOOKING = [
  ['Calendly', /calendly\.com/i], ['Acuity', /acuityscheduling\.com|as\.me\//i],
  ['Square Appointments', /squareup\.com\/appointments|square\.site\/book|book\.squareup/i],
  ['Vagaro', /vagaro\.com/i], ['Booksy', /booksy\.com/i], ['Fresha', /fresha\.com/i],
  ['Mindbody', /mindbodyonline\.com|mindbody\.io/i], ['GlossGenius', /glossgenius\.com/i],
  ['Boulevard', /joinblvd\.com|blvd\.co/i], ['StyleSeat', /styleseat\.com/i], ['Schedulicity', /schedulicity\.com/i],
  ['Setmore', /setmore\.com/i], ['SimplyBook', /simplybook\.(me|it)/i], ['Housecall Pro', /housecallpro\.com/i],
  ['Jobber', /getjobber\.com|clienthub\.getjobber/i], ['ServiceTitan', /servicetitan\.com/i],
  ['OpenTable', /opentable\.com/i], ['Resy', /resy\.com/i], ['Tock', /exploretock\.com/i],
  ['Toast', /toasttab\.com/i], ['Zocdoc', /zocdoc\.com/i], ['Tebra', /tebra\.com|patientfusion/i],
  ['Urable', /urable\.com/i], ['Mobile Tech RX', /mobiletechrx/i], ['Wix Bookings', /wix-bookings|bookings\.wix/i],
  ['Squarespace Scheduling', /squarespacescheduling/i]
];
const REVIEWS = [['Elfsight', /elfsight/i], ['Trustindex', /trustindex/i], ['Birdeye', /birdeye/i],
  ['Podium', /podium\.com/i], ['NiceJob', /nicejob/i], ['Yotpo', /yotpo/i], ['Trustpilot', /trustpilot/i],
  ['EmbedSocial', /embedsocial/i], ['Grade.us', /grade\.us/i]];
const STOCK = /(images\.unsplash\.com|unsplash\.com\/photos|shutterstock|istockphoto|gettyimages|pexels\.com|stock\.adobe|depositphotos|dreamstime|123rf)/i;

function analyse(page, city, business) {
  const html = page.html;
  const isHtml = /html/i.test(page.contentType) || /<html|<body/i.test(html);
  const noScript = html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const bodyHtml = (noScript.match(/<body\b[\s\S]*$/i) || [noScript])[0];
  const text = clean(bodyHtml);
  const words = text ? text.split(' ').length : 0;
  const early = text.slice(0, 1400);

  const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const description = metaContent(html, 'description');
  const viewport = metaContent(html, 'viewport');
  const generator = metaContent(html, 'generator');
  const ogImage = metaContent(html, 'og:image');
  const h1s = (noScript.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map(clean).filter(Boolean);
  const h2s = (noScript.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi) || []).map(clean).filter(Boolean);

  const anchors = [...noScript.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(m => ({ href: attr('<a ' + m[1] + '>', 'href') || '', text: clean(m[2]) || attr('<a ' + m[1] + '>', 'aria-label') || '' }));
  const buttons = [...noScript.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)].map(m => clean(m[1]));
  const inputsBtn = (noScript.match(/<input\b[^>]*type\s*=\s*["']?(submit|button)[^>]*>/gi) || []).map(t => attr(t, 'value') || '');

  const tel = uniq(anchors.filter(a => /^tel:/i.test(a.href)).map(a => a.href.replace(/^tel:/i, '')));
  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/);
  const phoneEarly = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(early);

  /* calls to action are judged on the page itself, not the menu: a "Contact Us"
     nav link is not a booking button, and a "Testimonials" nav link is not proof */
  const mainHtml = bodyHtml.replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ');
  const mainText = clean(mainHtml);
  const mainEarly = mainText.slice(0, 1400).toLowerCase();
  const mainAnchors = [...mainHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(m => clean(m[1]));
  const ctaTexts = uniq([...mainAnchors, ...buttons, ...inputsBtn]
    .filter(t => t && t.length <= 48 && CTA_RE.test(t)));
  const WEAK = /^(contact( us)?|enquire|inquire|get in touch)$/i;
  const ctaStrong = ctaTexts.filter(t => !WEAK.test(t.trim()));
  const ctaEarly = ctaStrong.some(t => mainEarly.includes(t.toLowerCase()));

  // forms: count visible fields per form
  const forms = (noScript.match(/<form\b[\s\S]*?<\/form>/gi) || []).map(f => {
    const fields = (f.match(/<(input|textarea|select)\b[^>]*>/gi) || [])
      .filter(t => !/type\s*=\s*["']?(hidden|submit|button|checkbox|radio)/i.test(t)).length;
    const search = /type\s*=\s*["']?search|role\s*=\s*["']?search|name\s*=\s*["']?(s|q|search)["'\s>]/i.test(f);
    return { fields, search };
  }).filter(f => !f.search && f.fields > 0);

  const navBlock = (noScript.match(/<nav\b[\s\S]*?<\/nav>/i) || [''])[0];
  const navLinks = uniq((navBlock.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []).map(clean).filter(Boolean)).length;

  const years = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})/gi)].map(m => +m[1])
    .filter(y => y > 1995 && y <= new Date().getFullYear() + 1);
  const copyrightYear = years.length ? Math.max(...years) : null;

  const imgs = noScript.match(/<img\b[^>]*>/gi) || [];
  const imgNoAlt = imgs.filter(t => { const a = attr(t, 'alt'); return a === null || !a.trim(); }).length;
  const stockHosts = uniq((html.match(new RegExp(STOCK.source, 'gi')) || []).map(s => s.toLowerCase()));

  const hrefs = anchors.map(a => a.href);
  const find = re => uniq(hrefs.map(h => (h.match(re) || [])[1]).filter(Boolean));
  const socials = {
    instagram: find(/instagram\.com\/([A-Za-z0-9_.]{2,30})\/?(?:[?#]|$)/i).filter(h => !/^(p|reel|explore|stories)$/i.test(h)),
    tiktok: find(/tiktok\.com\/@([A-Za-z0-9_.]{2,30})/i),
    facebook: find(/facebook\.com\/((?!sharer|share|dialog|plugins|tr\b)[A-Za-z0-9_.\-/]{2,60})/i),
    youtube: find(/youtube\.com\/((?:@|channel\/|c\/|user\/)[A-Za-z0-9_\-]{2,60})/i),
    yelp: find(/yelp\.com\/biz\/([A-Za-z0-9_\-]{2,80})/i),
    linkedin: find(/linkedin\.com\/(company\/[A-Za-z0-9_\-]{2,60})/i),
    google: uniq(hrefs.filter(h => /(maps\.google\.|google\.[a-z.]+\/maps|g\.page\/|maps\.app\.goo\.gl|goo\.gl\/maps|business\.google\.com)/i.test(h)))
  };
  const mapEmbed = /<iframe[^>]+google\.[a-z.]+\/maps/i.test(html);

  const schemaTypes = uniq([...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(m => [...m[1].matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g)]
    .flatMap(t => t[1] ? [t[1]] : t[2].replace(/"/g, '').split(',').map(s => s.trim()))));

  const detect = list => list.filter(([, re]) => re.test(html)).map(([n]) => n);
  const platform = detect(PLATFORMS)[0] || (generator && /wordpress/i.test(generator) ? 'WordPress' : null);

  const lowerCity = city.split(',')[0].trim().toLowerCase();
  const cityIn = s => !!(lowerCity && s && s.toLowerCase().includes(lowerCity));

  return {
    ok: page.status < 400 && isHtml,
    fetched: {
      url: page.url, status: page.status, https: page.url.startsWith('https:'),
      redirects: page.hops.length, ttfb: page.ttfb, ms: page.ms, bytes: page.bytes, truncated: page.truncated
    },
    seo: {
      title, titleLength: title.length, description: description || null,
      h1: h1s.slice(0, 3), h1Count: h1s.length, h2Count: h2s.length,
      genericH1: h1s.length ? GENERIC_H1.test(h1s[0]) : null,
      cityInTitle: cityIn(title), cityInH1: cityIn(h1s.join(' ')), cityInText: cityIn(text),
      schemaTypes, localBusinessSchema: schemaTypes.some(t => /LocalBusiness|Store|Restaurant|Salon|Spa|Dentist|Plumber|Roofing|Electrician|HomeAndConstruction|AutoRepair|AutomotiveBusiness|HealthAndBeauty|ProfessionalService|MedicalBusiness|FoodEstablishment|SportsActivityLocation/i.test(t)),
      ogImage: !!ogImage, viewport: !!viewport
    },
    contact: {
      telLinks: tel.length, phoneOnPage: phoneMatch ? phoneMatch[0] : null, phoneEarly,
      forms: forms.length, longestForm: forms.reduce((m, f) => Math.max(m, f.fields), 0),
      ctaTexts: ctaTexts.slice(0, 8), ctaStrong: ctaStrong.slice(0, 8), ctaEarly,
      booking: detect(BOOKING), mapEmbed
    },
    content: {
      words, thin: words < 120, copyrightYear, images: imgs.length, imagesMissingAlt: imgNoAlt,
      stockHosts, navLinks, reviewWidgets: detect(REVIEWS),
      mentionsReviews: /\b(testimonials?|reviews?|5[- ]star|five[- ]star|★★★)/i.test(mainText),
      prices: (mainText.match(/\$\s?\d{2,5}/g) || []).length,
      businessNameInTitle: !!(business && title.toLowerCase().includes(business.toLowerCase().split(' ')[0]))
    },
    tech: {
      platform, builder: detect(BUILDERS)[0] || null, generator: generator || null,
      analytics: /googletagmanager\.com|google-analytics\.com|gtag\(/i.test(html),
      metaPixel: /connect\.facebook\.net|fbq\(/i.test(html)
    },
    socials
  };
}

module.exports.analyse = analyse;
