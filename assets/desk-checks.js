/* Walsh Digital Co. — Audit Desk: industries, plans and the checks.
   Every finding the desk writes comes from one of these checks, and every
   check is either measured (scan, Google lookup, speed test) or marked by
   hand. Nothing is inferred beyond that, so nothing is invented.

   ⚠ PLANS mirrors the prices on services.html, index.html and site.js.
   Change them together. */
(function (root) {
  'use strict';

  var INDUSTRIES = {
    beauty:  { label: 'Beauty & wellness', trade: 'salon', search: 'salons', customers: 'clients', customer: 'client',
               action: 'book an appointment', cta: 'Book now', booking: 'Online booking', bookingDetail: 'real availability, deposits to stop no-shows, and intake forms up front',
               proof: 'before-and-after photos', social: true },
    auto:    { label: 'Automotive', trade: 'auto shop', search: 'auto detailing', customers: 'customers', customer: 'customer',
               action: 'get a quote', cta: 'Get a quote', booking: 'Quote requests', bookingDetail: 'pick the vehicle and the service, get a price, and put down a deposit to hold the slot',
               proof: 'before-and-after shots of real vehicles', social: true },
    home:    { label: 'Home services & trades', trade: 'contractor', search: 'contractors', customers: 'homeowners', customer: 'homeowner',
               action: 'request an estimate', cta: 'Get a free estimate', booking: 'Estimate requests', bookingDetail: 'a short estimate form asking exactly what you need to know, so the lead arrives usable',
               proof: 'photos of finished jobs', social: false },
    food:    { label: 'Restaurant, café or bar', trade: 'restaurant', search: 'restaurants', customers: 'guests', customer: 'guest',
               action: 'reserve a table or order', cta: 'Reserve a table', booking: 'Reservations and online ordering', bookingDetail: 'reservations and ordering one tap from the menu',
               proof: 'photos of the food and the room', social: true },
    fitness: { label: 'Fitness & health', trade: 'studio', search: 'gyms', customers: 'members', customer: 'member',
               action: 'book a first session', cta: 'Book a free class', booking: 'Class and appointment booking', bookingDetail: 'a free first session bookable online, with reminders',
               proof: 'real members and real results', social: true },
    pro:     { label: 'Professional services', trade: 'firm', search: 'firms', customers: 'clients', customer: 'client',
               action: 'book a consultation', cta: 'Book a consultation', booking: 'Consultation booking', bookingDetail: 'a consultation calendar with a short intake form',
               proof: 'client results and reviews', social: false },
    retail:  { label: 'Retail', trade: 'shop', search: 'shops', customers: 'shoppers', customer: 'shopper',
               action: 'visit or shop online', cta: 'Shop now', booking: 'Online shopping or click-and-collect', bookingDetail: 'products online with click-and-collect',
               proof: 'photos of the products and the shop', social: true },
    other:   { label: 'Something else', trade: 'business', search: 'businesses', customers: 'customers', customer: 'customer',
               action: 'get in touch', cta: 'Get in touch', booking: 'Online enquiries', bookingDetail: 'a short enquiry form that goes straight to your phone',
               proof: 'photos of real work', social: false }
  };

  /* the public site's industry labels → desk keys (for leads from audit.html) */
  var SITE_INDUSTRY = { 'Beauty & wellness': 'beauty', 'Automotive': 'auto', 'Home services & trades': 'home',
    'Restaurant, café or bar': 'food', 'Fitness & health': 'fitness', 'Professional services': 'pro', 'Retail': 'retail' };

  var PLANS = {
    Foundation: { price: 199, rank: 1, line: 'custom website, brand identity and foundational SEO, hosted and maintained' },
    Growth:     { price: 499, rank: 2, line: 'everything in Foundation plus 15 short-form videos a month, social run on 2 platforms, full local SEO and Google Business Profile, and monthly reporting' },
    Premium:    { price: 799, rank: 3, line: 'everything in Growth plus 30 videos a month, 3+ platforms with engagement, and booking, quotes and payments built for the trade' }
  };

  var AREAS = [
    { key: 'website', name: 'Website', weight: 0.4, word: 'website' },
    { key: 'google',  name: 'Google & local search', weight: 0.25, word: 'Google profile' },
    { key: 'social',  name: 'Social media', weight: 0.2, word: 'Instagram' },
    { key: 'brand',   name: 'Brand & content', weight: 0.15, word: 'branding' }
  ];

  /* ── small helpers ── */
  function q(s) { return '“' + s + '”'; }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function ago(days) {
    days = +days;
    if (days <= 1) return 'in the last day';
    if (days < 14) return days + ' days ago';
    if (days < 60) return Math.round(days / 7) + ' weeks ago';
    if (days < 365) return Math.round(days / 30) + ' months ago';
    var y = Math.round(days / 365);
    return y + (y === 1 ? ' year ago' : ' years ago');
  }
  /* the "latest review" select stores a bucket, not exact days */
  var REVIEW_GAP = { 30: 'the last month', 90: 'a couple of months', 180: 'three months or more',
                     365: 'six months or more', 999: 'over a year' };
  var POST_LABEL = { '7': 'this week', '30': 'this month', '90': '1–3 months ago', '180': '3–6 months ago',
                     '365': 'over 6 months ago', 'none': 'never' };

  var hasSite = function (c) { return !!c.p.website; };
  var scanned = function (c) { return hasSite(c) && c.scan && c.scan.ok; };
  var stat = function (c, id) { return c.res[id] && c.res[id].status; };

  /* each check: area, impact 1–3, effort 1 (an afternoon) – 3 (a project), plan that fixes it.
     auto(c) → [status|null, evidence|null]. Copy functions receive the context c. */
  var CHECKS = [

    /* ── website ───────────────────────────────────────── */
    { id: 'w_site', area: 'website', impact: 3, effort: 3, plan: 'Foundation',
      label: function () { return 'Has a website'; },
      auto: function (c) {
        if (hasSite(c)) return c.scan && !c.scan.ok && c.scanError ? [null, 'Site could not be fetched: ' + c.scanError] : ['good', null];
        return ['issue', 'No website given — check their Google profile and Instagram bio for one'];
      },
      issue: function (c) { return {
        title: 'No website to send people to',
        why: 'When someone hears about ' + c.biz + ' or finds them on Google, there is nowhere to see the work, check the details or ' + c.ind.action + '. Plenty of people take that as a reason to pick a competitor who has one.',
        fix: 'A fast, simple site built around one job: getting people to ' + c.ind.action + '.' }; },
      good: function () { return 'Has a website to send people to.'; },
      sumGood: 'a website', sumBad: 'there is no website to land on',
      opp: function (c) { return 'giving people somewhere to ' + c.ind.action; },
      hook: function (c) { return 'I couldn’t find a website for ' + c.biz; } },

    { id: 'w_https', area: 'website', impact: 2, effort: 1, plan: 'Foundation',
      label: function () { return 'Secure connection (HTTPS)'; },
      applies: scanned,
      auto: function (c) { return c.scan.fetched.https ? ['good', 'Loads over HTTPS'] : ['issue', 'Loads over plain http — browsers label it “Not secure”']; },
      issue: function (c) { return {
        title: 'Browsers label the site “Not secure”',
        why: 'Chrome shows “Not secure” beside the address. That is enough to make careful ' + c.ind.customers + ' leave, especially before they fill anything in.',
        fix: 'Serve the site over HTTPS with a valid certificate — standard with any decent hosting.' }; },
      good: function () { return 'Secure (HTTPS).'; },
      sumGood: 'a secure site', sumBad: 'the site shows as “Not secure”',
      opp: function () { return 'getting rid of the “Not secure” warning'; },
      hook: function () { return 'your site shows as “Not secure” in Chrome'; } },

    { id: 'w_headline', area: 'website', impact: 3, effort: 1, plan: 'Foundation',
      label: function () { return 'Headline says what they do and where'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var s = c.scan.seo, h = s.h1[0];
        if (!h) return ['issue', 'No main headline (H1) on the homepage'];
        if (s.genericH1) return ['issue', 'Main headline reads ' + q(trunc(h, 80))];
        var name = c.biz.toLowerCase();
        if (h.length <= c.biz.length + 4 && name.length > 3 && h.toLowerCase().indexOf(name.slice(0, 5)) >= 0)
          return ['issue', 'Main headline is only the business name: ' + q(h)];
        return [null, 'Main headline: ' + q(trunc(h, 90))];
      },
      issue: function (c) { return {
        title: 'The first screen doesn’t say what ' + c.biz + ' does',
        why: 'Visitors decide in a few seconds whether they are in the right place. A vague headline makes them work it out, and most won’t bother.',
        fix: 'Lead with what, where and for whom — something like ' + q(cap(c.trade) + ' in ' + c.city) + ' — with the ' + q(c.ind.cta) + ' button right beneath it.' }; },
      good: function () { return 'The headline makes it clear what the business does.'; },
      sumGood: 'a clear homepage headline', sumBad: 'the homepage doesn’t say clearly what they do',
      opp: function () { return 'a first screen that says what they do, where, and how to get started'; },
      hook: function (c) { var h = c.scan && c.scan.seo.h1[0];
        return h && c.scan.seo.genericH1 ? 'the first thing your homepage says is ' + q(trunc(h, 50)) + ', rather than what you do and where'
          : 'your homepage doesn’t say what you do or where until you scroll'; } },

    { id: 'w_cta', area: 'website', impact: 3, effort: 1, plan: 'Foundation',
      label: function (c) { return 'Obvious next step near the top (' + c.ind.cta.toLowerCase() + ')'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var k = c.scan.contact, t = k.ctaStrong || k.ctaTexts;
        if (!k.ctaTexts.length) return ['issue', 'No booking, quote or contact button found on the homepage'];
        if (!t.length) return ['issue', 'Only a generic ' + q(k.ctaTexts[0]) + ' link — no booking or quote button'];
        var list = t.slice(0, 3).map(q).join(', ');
        return c.scan.contact.ctaEarly ? ['good', 'Buttons near the top: ' + list] : [null, 'Buttons found further down: ' + list];
      },
      issue: function (c) { return {
        title: 'No obvious next step for visitors',
        why: 'People who are ready to ' + c.ind.action + ' have to hunt for how. Every extra step loses a share of the ones who were ready.',
        fix: 'One primary button — ' + q(c.ind.cta) + ' — in the header and the first screen, repeated down the page.' }; },
      good: function () { return 'There is a clear call to action near the top.'; },
      sumGood: 'clear calls to action', sumBad: 'there’s no clear next step for visitors',
      opp: function (c) { return 'making ' + q(c.ind.cta) + ' the obvious next step on every page'; },
      hook: function (c) { return 'there isn’t an obvious ' + q(c.ind.cta) + ' button when your homepage first loads'; } },

    { id: 'w_tap', area: 'website', impact: 3, effort: 1, plan: 'Foundation',
      label: function () { return 'Phone number is tap-to-call'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var k = c.scan.contact;
        if (k.telLinks) return ['good', 'Tap-to-call link present' + (k.phoneEarly ? ', near the top' : '')];
        if (k.phoneOnPage) return ['issue', 'The number ' + k.phoneOnPage + ' is on the page, but not as a tap-to-call link'];
        return ['issue', 'No phone number found on the homepage'];
      },
      issue: function (c) { return {
        title: 'Calling takes more than one tap on a phone',
        why: 'Most people looking up ' + c.biz + ' are on their phone. If the number isn’t a tappable link near the top, many simply call the next one on the list.',
        fix: 'A tap-to-call button in the mobile header, and the number set as real text rather than an image.' }; },
      good: function () { return 'Phone number is tappable on mobile.'; },
      sumGood: 'an easy-to-reach phone number', sumBad: 'mobile visitors can’t call in one tap',
      opp: function () { return 'making it one tap to call from a phone'; },
      hook: function (c) { return c.scan && c.scan.contact.phoneOnPage && !c.scan.contact.telLinks
        ? 'your phone number isn’t tappable on mobile, so anyone on their phone has to copy it out to call'
        : 'I couldn’t find a way to call you from your homepage on my phone'; } },

    { id: 'w_mobile', area: 'website', impact: 3, effort: 2, plan: 'Foundation',
      label: function () { return 'Works well on a phone'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        return c.scan.seo.viewport ? [null, 'Mobile viewport is set — check the layout on a real phone']
          : ['issue', 'No mobile viewport tag, so phones likely show a shrunken desktop page'];
      },
      issue: function (c) { return {
        title: 'The site is hard to use on a phone',
        why: 'Most local searches happen on a phone. Pinching, tiny text and buttons too small to tap read as outdated, and send people straight back to Google.',
        fix: 'A mobile-first layout: readable type, thumb-sized buttons, and the ' + q(c.ind.cta) + ' action always in reach.' }; },
      good: function () { return 'Works well on mobile.'; },
      sumGood: 'a site that works on a phone', sumBad: 'the site is awkward on a phone',
      opp: function () { return 'a site that works properly on a phone'; },
      hook: function () { return 'your site is hard to use on a phone'; } },

    { id: 'w_speed', area: 'website', impact: 2, effort: 2, plan: 'Foundation',
      label: function () { return 'Loads quickly on mobile'; },
      applies: hasSite,
      auto: function (c) {
        if (c.speed && c.speed.score != null) {
          var ev = 'Google PageSpeed, mobile: ' + c.speed.score + '/100' + (c.speed.lcp ? ' · main content visible after ' + c.speed.lcp : '');
          return [c.speed.score >= 65 ? 'good' : 'issue', ev];
        }
        if (!scanned(c)) return [null, null];
        var f = c.scan.fetched, kb = Math.round(f.bytes / 1024);
        if (f.bytes > 1500000 || f.ttfb > 2500) return ['issue', 'Homepage HTML is ' + kb + ' KB and took ' + f.ttfb + ' ms to start arriving'];
        return [null, 'HTML ' + kb + ' KB, first byte in ' + f.ttfb + ' ms — run the speed test for a real score'];
      },
      issue: function (c) { return {
        title: 'Slow to load on a phone',
        why: 'On cell service, a slow page loses people who had already decided to look ' + c.biz + ' up — the warmest traffic there is.',
        fix: 'Compress the images, drop unused page-builder scripts, and test on a mid-range phone over cellular rather than office wifi.' }; },
      good: function () { return 'Loads quickly on mobile.'; },
      sumGood: 'a fast site', sumBad: 'the site is slow on a phone',
      opp: function () { return 'a site that loads fast on cell service'; },
      hook: function (c) { return c.speed && c.speed.score != null
        ? 'Google’s own speed test scores your homepage ' + c.speed.score + '/100 on mobile'
        : 'your site is slow to load on a phone'; } },

    { id: 'w_modern', area: 'website', impact: 3, effort: 3, plan: 'Foundation',
      label: function () { return 'Looks current and professional'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var t = c.scan.tech, bits = [];
        if (t.platform) bits.push('Built on ' + t.platform + (t.builder ? ' with ' + t.builder : ''));
        var y = c.scan.content.copyrightYear;
        if (y && y < c.year - 2) bits.push('footer copyright ' + y);
        return [null, bits.length ? cap(bits.join(' · ')) : null];
      },
      issue: function (c) { return {
        title: 'The design looks dated',
        why: 'People can’t judge the quality of the work before they buy, so they judge what they can see. A dated site makes a good business look smaller, cheaper or closed.',
        fix: 'A redesign built on the brand, with real photography and a clean, fast, modern layout.' }; },
      good: function () { return 'The site looks current and professional.'; },
      sumGood: 'a professional-looking website', sumBad: 'the website looks dated',
      opp: function () { return 'a website that looks as good as the work'; },
      hook: function () { return 'your website doesn’t do justice to the work you’re putting out'; } },

    { id: 'w_photos', area: 'website', impact: 2, effort: 2, plan: 'Growth',
      label: function () { return 'Real photos of their own work'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var h = c.scan.content.stockHosts;
        return h.length ? ['issue', 'Images come from stock libraries (' + h.slice(0, 2).join(', ') + ')'] : [null, null];
      },
      issue: function (c) { return {
        title: 'Stock photos instead of their own work',
        why: 'People spot stock photography quickly, and it throws away the one thing competitors can’t copy — ' + c.biz + '’s own ' + c.ind.proof + '.',
        fix: 'A shoot at the business — the team, the space and real ' + c.ind.proof + ' — used across the site and social.' }; },
      good: function () { return 'Uses real photography of the business.'; },
      sumGood: 'real photography', sumBad: 'the site relies on stock photos',
      opp: function (c) { return 'showing real ' + c.ind.proof + ' instead of stock images'; },
      hook: function () { return 'most of the photos on your site look like stock rather than your own work'; } },

    { id: 'w_offer', area: 'website', impact: 2, effort: 1, plan: 'Foundation',
      label: function () { return 'Services and pricing are clear'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var n = c.scan.content.prices;
        return [null, n ? n + ' price' + (n === 1 ? '' : 's') + ' shown on the homepage' : 'No prices on the homepage'];
      },
      issue: function (c) { return {
        title: 'It isn’t clear what’s offered or roughly what it costs',
        why: 'If people can’t tell whether ' + c.biz + ' does what they need — or the ballpark cost — they call someone who makes it obvious, or don’t call at all.',
        fix: 'A clear services section with “starting at” prices or ranges and what is included in each.' }; },
      good: function () { return 'Services and pricing are easy to understand.'; },
      sumGood: 'a clear offer', sumBad: 'the offer and pricing are unclear',
      opp: function () { return 'making the services and starting prices obvious'; },
      hook: function () { return 'it’s hard to tell from your site what you offer and roughly what it costs'; } },

    { id: 'w_proof', area: 'website', impact: 2, effort: 1, plan: 'Foundation',
      label: function () { return 'Reviews or testimonials on the site'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var k = c.scan.content;
        if (k.reviewWidgets.length) return ['good', 'Review widget: ' + k.reviewWidgets.join(', ')];
        if (k.mentionsReviews) return [null, 'The homepage mentions reviews — check they are actually visible'];
        return ['issue', 'No reviews or testimonials found on the homepage'];
      },
      issue: function (c) { return {
        title: 'No reviews or proof on the website',
        why: c.biz + ' may have good reviews on Google, but visitors on the site never see them. Proof beside the button is what tips a stranger into deciding to ' + c.ind.action + '.',
        fix: 'Bring real Google reviews and a few photos of finished work onto the homepage, next to the main buttons.' }; },
      good: function () { return 'Reviews are shown on the site.'; },
      sumGood: 'reviews on show', sumBad: 'the site shows no reviews',
      opp: function () { return 'putting their reviews in front of website visitors'; },
      hook: function () { return 'none of your reviews appear on your website'; } },

    { id: 'w_booking', area: 'website', impact: 3, effort: 2, plan: 'Premium',
      label: function (c) { return 'Can ' + c.ind.action + ' online'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var k = c.scan.contact;
        if (k.booking.length) return ['good', 'Booking through ' + k.booking.join(', ')];
        if (k.forms) return ['good', 'Enquiry form on the homepage (' + k.longestForm + ' field' + (k.longestForm === 1 ? '' : 's') + ')' + (k.longestForm > 7 ? ' — long enough to put people off' : '')];
        return ['issue', 'No booking tool or enquiry form on the homepage (check the contact page too)'];
      },
      issue: function (c) { return {
        title: 'No way to ' + c.ind.action + ' online',
        why: 'Anyone browsing after hours, or who would rather not call, has nowhere to go — and after hours is when a lot of people plan.',
        fix: c.ind.booking + ' built into the site: ' + c.ind.bookingDetail + '.' }; },
      good: function (c) { return 'People can ' + c.ind.action + ' online.'; },
      sumGood: 'online booking', sumBad: 'nobody can ' + '{action}' + ' online',
      opp: function (c) { return 'letting people ' + c.ind.action + ' online, day or night'; },
      hook: function (c) { return 'there’s no way to ' + c.ind.action + ' on your site without calling during business hours'; } },

    { id: 'w_nav', area: 'website', impact: 1, effort: 1, plan: 'Foundation',
      label: function () { return 'Simple navigation'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var n = c.scan.content.navLinks;
        if (n > 8) return ['issue', n + ' links in the main menu'];
        if (n >= 2) return ['good', n + ' links in the main menu'];
        return [null, null];
      },
      issue: function () { return {
        title: 'The menu is crowded',
        why: 'Too many choices slow people down on the way to the one action that matters.',
        fix: 'Trim the menu to the four to six pages people actually use, with the main button set apart.' }; },
      good: function () { return 'Navigation is simple.'; },
      sumGood: 'simple navigation', sumBad: 'the menu is crowded',
      opp: function () { return 'a simpler menu'; },
      hook: function () { return 'your menu has more options than a visitor needs'; } },

    { id: 'w_seo', area: 'website', impact: 2, effort: 1, plan: 'Foundation',
      label: function (c) { return 'Search basics set (title, description, ' + c.city + ')'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var s = c.scan.seo, bad = [];
        if (!s.title || /^(home|index|untitled|welcome)\b/i.test(s.title)) bad.push('the page title is ' + q(s.title || 'missing'));
        if (!s.description) bad.push('there’s no meta description');
        if (c.p.location && !s.cityInTitle && !s.cityInH1) bad.push(c.city + ' isn’t in the title or headline');
        if (!s.localBusinessSchema) bad.push('no LocalBusiness structured data');
        if (bad.length >= 2) return ['issue', cap(bad.join('; '))];
        if (bad.length === 1) return [null, cap(bad[0])];
        return ['good', 'Title: ' + q(trunc(s.title, 70))];
      },
      issue: function (c) { return {
        title: 'Google isn’t being told what ' + c.biz + ' does or where',
        why: 'The page title and description are what appear in search results. Without the service and the town in them, ' + c.biz + ' is harder to find for “' + c.trade + ' in ' + c.city + '” searches.',
        fix: 'A title like ' + q(cap(c.trade) + ' in ' + c.city + ' | ' + c.biz) + ', a real meta description, and LocalBusiness structured data.' }; },
      good: function () { return 'Search basics are in place.'; },
      sumGood: 'solid search basics', sumBad: 'the site isn’t set up to be found locally',
      opp: function (c) { return 'showing up for “' + c.trade + ' in ' + c.city + '” searches'; },
      hook: function (c) { return 'your homepage never tells Google you’re in ' + c.city; } },

    { id: 'w_fresh', area: 'website', impact: 1, effort: 1, plan: 'Growth',
      label: function () { return 'Content is current'; },
      applies: hasSite,
      auto: function (c) {
        if (!scanned(c)) return [null, null];
        var y = c.scan.content.copyrightYear;
        if (y && y < c.year - 1) return ['issue', 'Footer copyright says ' + y];
        if (y) return ['good', 'Footer copyright ' + y];
        return [null, null];
      },
      issue: function () { return {
        title: 'The site looks like it hasn’t been touched in years',
        why: 'An old copyright date, expired offers or an abandoned blog quietly suggest the business might have closed.',
        fix: 'Update the footer and anything dated, then keep the site current as the business changes.' }; },
      good: function () { return 'Content looks current.'; },
      sumGood: 'up-to-date content', sumBad: 'the site looks abandoned',
      opp: function () { return 'a site that looks alive'; },
      hook: function (c) { var y = c.scan && c.scan.content.copyrightYear;
        return y ? 'your site’s footer still says © ' + y : 'parts of your site look like they haven’t been updated in a while'; } },

    /* ── google & local ────────────────────────────────── */
    { id: 'g_profile', area: 'google', impact: 3, effort: 1, plan: 'Growth',
      label: function () { return 'Google Business Profile exists'; },
      auto: function (c) {
        if (c.places) return ['good', c.places.name + (c.places.address ? ' — ' + c.places.address : '')];
        if (c.p.gbp) return ['good', 'Profile link provided'];
        return [null, null];
      },
      issue: function (c) { return {
        title: 'No Google Business Profile found',
        why: 'For “' + c.trade + ' near me” searches, the map results are the first thing people see — and most choose from them without ever opening a website.',
        fix: 'Create and verify the profile with the right categories, service area, hours, photos and services.' }; },
      good: function () { return 'Has a Google Business Profile.'; },
      sumGood: 'a Google Business Profile', sumBad: 'there’s no Google Business Profile',
      opp: function () { return 'getting onto Google Maps properly'; },
      hook: function (c) { return 'I couldn’t find ' + c.biz + ' on Google Maps'; } },

    { id: 'g_reviews', area: 'google', impact: 3, effort: 2, plan: 'Growth',
      label: function () { return 'Enough reviews, strong rating'; },
      applies: function (c) { return stat(c, 'g_profile') !== 'issue'; },
      auto: function (c) {
        if (c.g.reviews === '' || c.g.reviews == null) return [null, null];
        var n = +c.g.reviews, r = +c.g.rating;
        var ev = (r ? r + '★ from ' : '') + n + ' review' + (n === 1 ? '' : 's');
        return [r >= 4.4 && n >= 30 ? 'good' : 'issue', ev];
      },
      issue: function (c) { var n = +c.g.reviews, r = +c.g.rating; return {
        title: n < 30 ? 'Only ' + n + ' Google review' + (n === 1 ? '' : 's') : 'A ' + r + '★ rating trails what people pick',
        why: 'People compare the businesses in the map results at a glance. Fewer or weaker reviews than the competition means being skipped, even when the work is better.',
        fix: 'Ask every happy ' + c.ind.customer + ' for a review with a direct link — by text, right after the job — and reply to every one.' }; },
      good: function (c) { return 'Strong reviews: ' + c.g.rating + '★ from ' + c.g.reviews + '.'; },
      sumGood: 'strong Google reviews', sumBad: 'the review count is thin for the area',
      opp: function () { return 'a steady flow of new Google reviews'; },
      hook: function (c) { return 'you have ' + c.g.reviews + ' Google reviews, which is thin for how good your work looks'; } },

    { id: 'g_recent', area: 'google', impact: 2, effort: 1, plan: 'Growth',
      label: function () { return 'Recent reviews (last two months)'; },
      applies: function (c) { return stat(c, 'g_profile') !== 'issue'; },
      auto: function (c) {
        if (!c.g.lastReview) return [null, null];
        var d = +c.g.lastReview;
        return [d <= 60 ? 'good' : 'issue', d <= 60 ? 'A review in the last month' : 'No new reviews in ' + REVIEW_GAP[d]];
      },
      issue: function (c) { return {
        title: 'No new Google reviews in ' + REVIEW_GAP[+c.g.lastReview],
        why: 'Recent reviews read as “still open, still good”. A profile that has gone quiet looks tired next to competitors collecting them every week.',
        fix: 'A review request after every job, automated so it actually happens.' }; },
      good: function () { return 'Reviews are coming in regularly.'; },
      sumGood: 'reviews still coming in', sumBad: 'reviews have dried up',
      opp: function () { return 'getting reviews coming in again'; },
      hook: function (c) { return 'you haven’t had a new Google review in ' + REVIEW_GAP[+c.g.lastReview]; } },

    { id: 'g_replies', area: 'google', impact: 1, effort: 1, plan: 'Growth',
      label: function () { return 'Owner replies to reviews'; },
      applies: function (c) { return stat(c, 'g_profile') !== 'issue'; },
      auto: function () { return [null, null]; },
      issue: function () { return {
        title: 'Reviews go unanswered',
        why: 'Replies show a real person cares — and an unanswered complaint is the first thing a careful customer reads.',
        fix: 'Reply to every review: briefly to the good ones, calmly and properly to the bad ones.' }; },
      good: function () { return 'Reviews get replies.'; },
      sumGood: 'reviews that get replies', sumBad: 'reviews go unanswered',
      opp: function () { return 'replying to every review'; },
      hook: function () { return 'most of your Google reviews haven’t had a reply'; } },

    { id: 'g_photos', area: 'google', impact: 2, effort: 1, plan: 'Growth',
      label: function () { return 'Plenty of recent photos on the profile'; },
      applies: function (c) { return stat(c, 'g_profile') !== 'issue'; },
      auto: function (c) {
        if (c.g.photos === '' || c.g.photos == null) return [null, null];
        var n = +c.g.photos;
        if (n < 5) return ['issue', 'Only ' + n + ' photo' + (n === 1 ? '' : 's') + ' on the profile'];
        return [null, (n >= 10 ? '10+' : n) + ' photos — check how recent they are'];
      },
      issue: function (c) { return {
        title: 'Few or old photos on the Google profile',
        why: 'Photos are the first look inside the business, and profiles with plenty of current ones get more clicks, calls and direction requests.',
        fix: 'Add twenty or more current photos — the space, the team and real ' + c.ind.proof + ' — and a few new ones every month.' }; },
      good: function () { return 'The profile has plenty of good photos.'; },
      sumGood: 'a well-photographed profile', sumBad: 'the Google profile has few photos',
      opp: function () { return 'a Google profile full of current photos'; },
      hook: function () { return 'your Google profile only has a handful of photos'; } },

    { id: 'g_complete', area: 'google', impact: 2, effort: 1, plan: 'Growth',
      label: function () { return 'Profile complete (hours, website, categories)'; },
      applies: function (c) { return stat(c, 'g_profile') !== 'issue'; },
      auto: function (c) {
        if (!c.places) return [null, null];
        if (!c.places.hasHours) return ['issue', 'No opening hours on the profile'];
        if (!c.places.website) return ['issue', 'No website linked from the profile'];
        return ['good', 'Hours and website listed' + (c.places.category ? ' · category: ' + c.places.category : '')];
      },
      issue: function () { return {
        title: 'The Google profile is incomplete',
        why: 'Missing hours, services or a website link make people guess — and Google shows complete profiles more often.',
        fix: 'Fill in every field: categories, services, service area, hours, website, booking link and a description.' }; },
      good: function () { return 'The profile is filled in.'; },
      sumGood: 'a complete Google profile', sumBad: 'the Google profile is incomplete',
      opp: function () { return 'a fully completed Google profile'; },
      hook: function (c) { return c.places && !c.places.hasHours ? 'your Google profile doesn’t list opening hours' : 'your Google profile is missing some key details'; } },

    { id: 'g_mappack', area: 'google', impact: 3, effort: 3, plan: 'Growth',
      label: function (c) { return 'In the map results for “' + c.trade + ' ' + c.city + '”'; },
      applies: function (c) { return stat(c, 'g_profile') !== 'issue'; },
      auto: function () { return [null, null]; },
      issue: function (c) { return {
        title: 'Not showing in the map results for “' + c.trade + ' in ' + c.city + '”',
        why: 'The three businesses in the map block take most of the clicks on a local search. Everyone below it is competing for what is left.',
        fix: 'Full local SEO: a complete and active profile, consistent listings, service-area pages and a steady flow of reviews.' }; },
      good: function (c) { return 'Shows in the map results for “' + c.trade + ' ' + c.city + '”.'; },
      sumGood: 'a spot in the local map results', sumBad: 'they don’t show up in the local map results',
      opp: function (c) { return 'getting into the map results for “' + c.trade + ' in ' + c.city + '”'; },
      hook: function (c) { return 'when I searched “' + c.trade + ' in ' + c.city + '”, ' + c.biz + ' didn’t show up in the map results'; } },

    /* ── social ────────────────────────────────────────── */
    { id: 's_ig_exists', area: 'social', impact: 2, effort: 2, plan: 'Growth',
      label: function () { return 'Has an Instagram account'; },
      auto: function (c) {
        if (c.p.instagram) return ['good', c.p.instagram];
        if (scanned(c)) return ['issue', 'None given, and none linked from the website'];
        return [null, null];
      },
      issue: function (c) { return {
        title: 'No Instagram presence',
        why: 'For a lot of ' + c.ind.customers + ', Instagram is where they check whether the work is any good before they ' + c.ind.action + '. Without it there is nothing to scroll.',
        fix: 'Set the account up properly — bio, highlights, link — and post real work consistently.' }; },
      good: function () { return 'Has an Instagram account.'; },
      sumGood: 'an Instagram account', sumBad: 'there’s no Instagram to check them out on',
      opp: function () { return 'an Instagram that shows the work'; },
      hook: function () { return 'I couldn’t find an Instagram for you'; } },

    { id: 's_ig_active', area: 'social', impact: 3, effort: 2, plan: 'Growth',
      label: function () { return 'Instagram posted to recently'; },
      applies: function (c) { return stat(c, 's_ig_exists') === 'good'; },
      auto: function (c) {
        var v = c.ig.lastPost;
        if (!v) return [null, null];
        var ev = 'Last post ' + POST_LABEL[v] + (c.ig.perMonth !== '' && c.ig.perMonth != null ? ' · about ' + c.ig.perMonth + (+c.ig.perMonth === 1 ? ' post' : ' posts') + ' a month' : '');
        return [v === '7' || v === '30' ? 'good' : 'issue', ev];
      },
      issue: function (c) { return {
        title: c.ig.lastPost === 'none' ? 'The Instagram has never been posted to' : 'The Instagram has gone quiet — last post ' + POST_LABEL[c.ig.lastPost],
        why: 'A feed that has stopped makes people wonder whether ' + c.biz + ' is still open. They rarely ask; they just book elsewhere.',
        fix: 'A monthly content shoot and a posting schedule, so there is always something recent — without ' + c.biz + ' having to find the time.' }; },
      good: function () { return 'Instagram is active.'; },
      sumGood: 'an active Instagram', sumBad: 'their Instagram has gone quiet',
      opp: function () { return 'a feed that never goes quiet'; },
      hook: function (c) { return 'your last Instagram post was ' + POST_LABEL[c.ig.lastPost]; } },

    { id: 's_ig_video', area: 'social', impact: 2, effort: 2, plan: 'Growth',
      label: function () { return 'Uses short-form video (Reels)'; },
      applies: function (c) { return stat(c, 's_ig_exists') === 'good'; },
      auto: function () { return [null, null]; },
      issue: function (c) { return {
        title: 'Little or no short-form video',
        why: 'Reels are what Instagram shows to people who don’t already follow ' + c.biz + '. Photos alone mostly reach existing followers.',
        fix: 'Fifteen short vertical videos a month from one shoot day: the work, the team and the results.' }; },
      good: function () { return 'Uses short-form video.'; },
      sumGood: 'short-form video', sumBad: 'there’s little video to reach new people',
      opp: function () { return 'short-form video that reaches people nearby who don’t know them yet'; },
      hook: function () { return 'you’re not using Reels, which is how Instagram reaches people who don’t follow you yet'; } },

    { id: 's_ig_quality', area: 'social', impact: 2, effort: 2, plan: 'Growth',
      label: function () { return 'Content looks professional and on-brand'; },
      applies: function (c) { return stat(c, 's_ig_exists') === 'good'; },
      auto: function () { return [null, null]; },
      issue: function (c) { return {
        title: 'The feed undersells the work',
        why: 'People judge the work by the feed. Dark phone photos, mixed styles and random reposts undersell what ' + c.biz + ' actually does.',
        fix: 'Consistent, well-lit photography and video in a simple visual style that matches the brand.' }; },
      good: function () { return 'The feed looks professional.'; },
      sumGood: 'a good-looking feed', sumBad: 'the feed undersells the work',
      opp: function () { return 'a feed that looks as good as the work'; },
      hook: function () { return 'your Instagram doesn’t show the work as well as it deserves'; } },

    { id: 's_ig_bio', area: 'social', impact: 1, effort: 1, plan: 'Growth',
      label: function (c) { return 'Bio says what/where, links to ' + c.ind.cta.toLowerCase(); },
      applies: function (c) { return stat(c, 's_ig_exists') === 'good'; },
      auto: function () { return [null, null]; },
      issue: function (c) { return {
        title: 'The Instagram bio doesn’t turn visitors into ' + c.ind.customers,
        why: 'The bio is the first thing a profile visitor reads. Without what, where and a link to ' + c.ind.action + ', interest stops at the profile.',
        fix: 'A one-line bio — what, where, who for — and a link straight to ' + q(c.ind.cta) + '.' }; },
      good: function () { return 'The Instagram bio does its job.'; },
      sumGood: 'a clear Instagram bio', sumBad: 'the Instagram bio has no clear next step',
      opp: function () { return 'an Instagram bio that links straight to booking'; },
      hook: function (c) { return 'your Instagram bio doesn’t link anywhere people can ' + c.ind.action; } },

    { id: 's_ig_link', area: 'social', impact: 1, effort: 1, plan: 'Foundation',
      label: function () { return 'Website links to Instagram'; },
      applies: function (c) { return scanned(c) && stat(c, 's_ig_exists') === 'good'; },
      auto: function (c) {
        var h = c.scan.socials.instagram;
        return h.length ? ['good', 'Linked: @' + h[0]] : ['issue', 'The website has no link to Instagram'];
      },
      issue: function () { return {
        title: 'The website doesn’t link to Instagram',
        why: 'The feed is the proof, but visitors on the site never find it.',
        fix: 'Link the profiles from the header or footer, and show recent posts on the site.' }; },
      good: function () { return 'Website links to Instagram.'; },
      sumGood: 'a site and feed that are connected', sumBad: 'the site and the feed aren’t connected',
      opp: function () { return 'connecting the website and the feed'; },
      hook: function () { return 'your Instagram isn’t linked anywhere on your website'; } },

    { id: 's_tt', area: 'social', impact: 1, effort: 2, plan: 'Growth',
      label: function () { return 'Active on TikTok'; },
      applies: function (c) { return !!c.p.tiktok || c.ind.social; },
      auto: function (c) {
        if (!c.p.tiktok) return [null, 'No TikTok given'];
        var v = c.tt.lastPost;
        if (!v) return [null, c.p.tiktok];
        return [v === '7' || v === '30' ? 'good' : 'issue', c.p.tiktok + ' · last post ' + POST_LABEL[v]];
      },
      issue: function (c) { return {
        title: c.p.tiktok ? 'The TikTok has gone quiet' : 'Not on TikTok',
        why: 'TikTok is a cheap way to reach nearby people who have never heard of ' + c.biz + ' — using the same videos made for Instagram.',
        fix: 'Post the same short-form videos to TikTok. No extra shoot needed.' }; },
      good: function () { return 'Active on TikTok.'; },
      sumGood: 'an active TikTok', sumBad: 'they’re missing TikTok',
      opp: function () { return 'reusing their videos on TikTok'; },
      hook: function () { return 'you’re not using TikTok, even though the same videos would work there'; } },

    /* ── brand ─────────────────────────────────────────── */
    { id: 'b_logo', area: 'brand', impact: 2, effort: 2, plan: 'Foundation',
      label: function () { return 'Professional logo'; },
      auto: function () { return [null, null]; },
      issue: function () { return {
        title: 'The logo undersells the business',
        why: 'A homemade or dated logo makes everything around it — the van, the site, the feed — look less established.',
        fix: 'A proper identity: logo, colour palette and type, built to work at every size.' }; },
      good: function () { return 'The logo looks professional.'; },
      sumGood: 'a professional logo', sumBad: 'the logo undersells them',
      opp: function () { return 'a brand that looks established'; },
      hook: function () { return 'your logo isn’t doing the business justice'; } },

    { id: 'b_consistent', area: 'brand', impact: 2, effort: 2, plan: 'Foundation',
      label: function () { return 'Same look across site, Google and social'; },
      auto: function () { return [null, null]; },
      issue: function (c) { return {
        title: 'Website, Google and social look like different businesses',
        why: 'When the colours, logo and tone change from place to place, ' + c.biz + ' reads as smaller and less organised than it is.',
        fix: 'One visual system applied everywhere: the site, profile images, social templates and signage.' }; },
      good: function () { return 'The brand is consistent everywhere.'; },
      sumGood: 'a consistent brand', sumBad: 'the brand looks different everywhere',
      opp: function () { return 'one consistent look everywhere people find them'; },
      hook: function () { return 'your website, Google profile and Instagram all look slightly like different businesses'; } },

    { id: 'b_diff', area: 'brand', impact: 2, effort: 1, plan: 'Foundation',
      label: function () { return 'A clear reason to choose them'; },
      auto: function () { return [null, null]; },
      issue: function (c) { return {
        title: 'Nothing says why ' + c.biz + ' over the competition',
        why: 'If every competitor in ' + c.city + ' promises “quality service at fair prices”, customers end up choosing on price or distance.',
        fix: 'Pin down the real difference — speciality, guarantee, speed, experience — and lead with it everywhere.' }; },
      good: function () { return 'Clear about what makes them different.'; },
      sumGood: 'a clear point of difference', sumBad: 'nothing sets them apart',
      opp: function () { return 'a clear reason to choose them over the competition'; },
      hook: function (c) { return 'nothing online says why someone should pick ' + c.biz + ' over the competition'; } }
  ];

  root.DeskData = { INDUSTRIES: INDUSTRIES, SITE_INDUSTRY: SITE_INDUSTRY, PLANS: PLANS, AREAS: AREAS, CHECKS: CHECKS,
                    POST_LABEL: POST_LABEL, util: { q: q, trunc: trunc, cap: cap, ago: ago } };
})(window);
