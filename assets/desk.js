/* Walsh Digital Co. — Audit Desk (internal).
   Inputs → checks (desk-checks.js) → a client-ready audit, a plan
   recommendation, and outreach written from the actual findings.
   Everything stays in this browser (localStorage) unless exported. */
(function () {
  'use strict';

  var D = window.DeskData, U = D.util;
  var LS_DRAFT = 'wdc.desk.draft', LS_SAVED = 'wdc.desk.saved', LS_KEY = 'wdc.desk.key', LS_PSI = 'wdc.desk.psi';
  var STUDIO = { name: 'Phillip Walsh', company: 'Walsh Digital Co.', phone: '(925) 494-5015',
                 site: 'walshdigitalco.com', email: 'hello@walshdigitalco.com' };

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return [].slice.call((el || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function join(a) { return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ── state ─────────────────────────────────────────── */
  function blank() {
    return {
      id: uid(), source: 'outbound',
      p: { business: '', website: '', instagram: '', tiktok: '', gbp: '', industry: 'other', trade: '',
           location: '', contact: '', email: '', phone: '', notes: '', hookGood: '', hookSeen: '' },
      g: { rating: '', reviews: '', lastReview: '', photos: '' },
      ig: { followers: '', lastPost: '', perMonth: '' },
      tt: { followers: '', lastPost: '' },
      obs: {}, scan: null, scanError: null, places: null, speed: null, updated: Date.now()
    };
  }
  var st = Object.assign(blank(), store(LS_DRAFT) || {});
  ['p', 'g', 'ig', 'tt'].forEach(function (k) { st[k] = Object.assign(blank()[k], st[k] || {}); });
  st.obs = st.obs || {};
  var view = 'internal';

  /* ── engine ────────────────────────────────────────── */
  function context() {
    var p = st.p, ind = D.INDUSTRIES[p.industry] || D.INDUSTRIES.other;
    return {
      p: p, ind: ind, g: st.g, ig: st.ig, tt: st.tt, scan: st.scan, scanError: st.scanError,
      places: st.places, speed: st.speed, res: {},
      biz: p.business.trim() || 'the business',
      city: (p.location || '').split(',')[0].trim() || 'the area',
      trade: (p.trade || '').trim().toLowerCase() || ind.trade,
      first: (p.contact || '').trim().split(/\s+/)[0] || '',
      year: new Date().getFullYear()
    };
  }
  function fill(s, c) {
    return String(s).replace(/\{action\}/g, c.ind.action).replace(/\{trade\}/g, c.trade).replace(/\{biz\}/g, c.biz);
  }

  function evaluate() {
    var c = context();
    D.CHECKS.forEach(function (k) {
      var applies = !k.applies || k.applies(c);
      var auto = applies ? (k.auto(c) || [null, null]) : [null, null];
      var manual = st.obs[k.id];
      var status = !applies ? 'skip' : manual === 'good' || manual === 'issue' ? manual
                 : manual === 'na' ? 'unknown' : (auto[0] || 'unknown');
      c.res[k.id] = { check: k, applies: applies, auto: auto[0], evidence: auto[1], manual: manual, status: status };
    });
    return c;
  }

  function scores(c) {
    var out = {}, tot = 0, wsum = 0, assessed = 0, total = 0;
    D.AREAS.forEach(function (a) {
      var got = 0, max = 0, n = 0, issues = 0;
      D.CHECKS.forEach(function (k) {
        var r = c.res[k.id];
        if (k.area !== a.key || r.status === 'skip') return;
        total++;
        if (r.status === 'unknown') return;
        n++; assessed++; max += k.impact;
        if (r.status === 'good') got += k.impact; else issues++;
      });
      var score = max ? Math.round(got / max * 100) : null;
      out[a.key] = { score: score, n: n, issues: issues };
      if (score != null) { tot += score * a.weight; wsum += a.weight; }
    });
    // one or two checks don't make a verdict
    out.overall = wsum && assessed >= 4 ? Math.round(tot / wsum) : null;
    out.assessed = assessed; out.total = total;
    return out;
  }
  function band(score) {
    if (score == null) return { word: 'Not assessed', cls: 'na' };
    if (score >= 80) return { word: 'Strong', cls: 'ok' };
    if (score >= 60) return { word: 'Solid, with gaps', cls: 'mid' };
    if (score >= 40) return { word: 'Leaking customers', cls: 'warn' };
    return { word: 'Costing them customers', cls: 'bad' };
  }

  function rank(c) {
    var issues = [], goods = [];
    D.CHECKS.forEach(function (k) {
      var r = c.res[k.id];
      if (r.status === 'issue') issues.push(r);
      if (r.status === 'good') goods.push(r);
    });
    var pr = function (r) { return r.check.impact * 3 - r.check.effort; };
    issues.sort(function (a, b) { return pr(b) - pr(a) || b.check.impact - a.check.impact; });
    goods.sort(function (a, b) { return b.check.impact - a.check.impact; });
    return { issues: issues, goods: goods };
  }

  /* "has a website" isn't a compliment; lead with strengths that took effort */
  function strengths(c, rk) {
    var TRIVIAL = ['w_site', 's_ig_exists', 'g_profile', 'w_https', 'w_nav', 's_ig_link'];
    var G = rk.goods.filter(function (r) { return TRIVIAL.indexOf(r.check.id) < 0; });
    if (+c.g.rating >= 4.6 && c.res.g_reviews.status === 'issue') {
      G.unshift({ check: { sumGood: 'a ' + c.g.rating + '★ Google rating' } });
    }
    return G.length ? G : rk.goods.filter(function (r) { return r.check.id !== 'w_site'; });
  }
  /* a check's fix, as the second half of a sentence addressed to the owner */
  function fixClause(r, c) { var f = fill(r.check.issue(c).fix, c); return f.charAt(0).toLowerCase() + f.slice(1); }

  function summary(c, rk, sc) {
    if (sc.assessed < 4) return '';
    var I = rk.issues, biz = c.biz, cust = c.ind.customers, out = [];
    var G = strengths(c, rk);
    if (!I.length) {
      return biz + '’s online presence is in genuinely good shape: ' + join(G.slice(0, 3).map(function (r) { return fill(r.check.sumGood, c); })) +
        '. There is no urgent leak to fix — the opportunity is keeping it this way as competitors catch up.';
    }
    var bad = I.slice(0, 2).map(function (r) { return fill(r.check.sumBad, c); });
    if (G.length) {
      out.push(biz + ' has ' + join(G.slice(0, 2).map(function (r) { return fill(r.check.sumGood, c); })) + ', but ' +
        join(bad) + ' — gaps that are likely costing them ' + cust + '.');
    } else {
      out.push(biz + '’s online presence has gaps that are likely costing them ' + cust + ': ' + join(bad) + '.');
    }
    var soc = c.res.s_ig_active, gr = c.res.g_reviews;
    var said = I.slice(0, 2).map(function (r) { return r.check.id; });
    if (soc.status === 'good' && I.every(function (r) { return r.check.area !== 'social'; })) out.push('Their Instagram is active and doing its job.');
    else if (soc.status === 'issue' && said.indexOf('s_ig_active') < 0) out.push('Their social presence has gone quiet, which makes the business look less active than it is.');
    if (gr.status === 'good' && I[0].check.area !== 'google' && !/Google rating/.test(out[0])) out.push('Reviews are a real strength to build on.');
    var top = I[0].check, eff = top.effort === 1 ? 'a quick fix with an outsized effect'
      : top.effort === 2 ? 'a matter of weeks, not months' : 'the biggest single lever for new ' + cust;
    out.push('Their strongest immediate opportunity is ' + fill(top.opp(c), c) + ' — ' + eff + '.');
    return out.join(' ');
  }

  function recommend(c, rk, sc) {
    if (sc.assessed < 5) return null;
    var is = function (id) { return c.res[id].status === 'issue'; };
    var inArea = function (a) { return rk.issues.filter(function (r) { return r.check.area === a; }).length; };
    var social = is('s_ig_exists') || is('s_ig_active') || is('s_ig_video') || inArea('social') >= 2;
    var google = is('g_profile') || is('g_reviews') || is('g_recent') || is('g_mappack') || inArea('google') >= 2;
    var web = is('w_site') || is('w_modern') || is('w_mobile') || inArea('website') >= 3;
    var brand = inArea('brand') >= 1;
    var feature = is('w_booking') && ['beauty', 'auto', 'home', 'fitness', 'food'].indexOf(c.p.industry) >= 0;
    var name, alt = null, note = '';

    if (feature && (social || google)) { name = 'Premium'; alt = 'Growth, adding a simple booking link in place of the built-in features'; }
    else if (social || google) { name = 'Growth'; alt = web || brand ? null : 'Build your own: Social + content at $399/mo, if the website really is fine'; }
    else if (web || brand || feature) { name = 'Foundation'; note = feature ? 'Add a booking tool link as a quick win; Premium only if they want deposits and quotes built in.' : ''; }
    else return { name: null, why: ['Nothing urgent. Send the audit as a courtesy, point out what is working, and stay in touch.'] };

    if (name === 'Growth' && !alt) alt = 'Foundation at $199/mo if budget is tight — it fixes the website and brand, not the social and Google work';
    var r = D.PLANS[name].rank;
    var why = rk.issues.filter(function (x) { return D.PLANS[x.check.plan].rank <= r; }).slice(0, 4)
      .map(function (x) { return fill(x.check.issue(c).title, c); });
    return { name: name, price: D.PLANS[name].price, line: D.PLANS[name].line, why: why, alt: alt, note: note };
  }

  function outreach(c, rk, sc, sum, rec) {
    var I = rk.issues, G = rk.goods, biz = c.biz, first = c.first;
    var hi = first ? 'Hi ' + first : 'Hi there';
    var top = I[0], quick = I.filter(function (r) { return r.check.effort === 1; })[0] || top;
    var seen = (c.p.hookSeen || '').trim() || (top ? fill(top.check.hook(c), c) : 'a couple of things on your website and Google profile worth fixing');
    var good = (c.p.hookGood || '').trim();
    if (!good) {
      var g = G.filter(function (r) { return ['g_reviews', 's_ig_active', 's_ig_quality', 'w_modern', 'b_logo', 'w_booking'].indexOf(r.check.id) >= 0; })[0];
      good = !g ? 'the work you’re putting out'
        : g.check.id === 'g_reviews' ? 'your ' + c.g.rating + '★ from ' + c.g.reviews + ' Google reviews'
        : g.check.id === 's_ig_active' ? 'how consistently you post on Instagram'
        : g.check.id === 's_ig_quality' ? 'the work on your Instagram'
        : g.check.id === 'w_booking' ? 'that people can ' + c.ind.action + ' online'
        : 'how professional ' + biz + ' looks';
    }
    var n = I.length, count = n >= 3 ? 'three' : n === 2 ? 'two' : 'a couple of';
    var areaWord = top ? D.AREAS.filter(function (a) { return a.key === top.check.area; })[0].word : 'online presence';
    var sig = '\n\n' + STUDIO.name + '\n' + STUDIO.company + ' · ' + STUDIO.site + ' · ' + STUDIO.phone;
    var fixes = I.slice(0, 3).map(function (r, i) { return (i + 1) + '. ' + fill(r.check.issue(c).title, c) + '. The fix: ' + fixClause(r, c); }).join('\n');
    var looked = [c.p.website && 'website', c.res.g_profile.status !== 'unknown' && 'Google profile',
                  c.p.instagram && 'Instagram', c.p.tiktok && 'TikTok'].filter(Boolean);
    var s = [];

    if (st.source === 'inbound') {
      s.push({ key: 'deliver', name: 'Audit delivery email', subject: 'Your free audit — ' + biz,
        body: hi + ',\n\nThanks for asking for an audit. I went through ' + biz + '’s ' + (join(looked) || 'online presence') +
          ' the way a new ' + c.ind.customer + ' would. Here’s the short version:\n\n' +
          (sum || '[summary]') + '\n\nThe fixes I’d do first:\n' + (fixes || '[top fixes]') +
          (strengths(c, rk).length ? '\n\nWhat’s already working: ' + join(strengths(c, rk).slice(0, 3).map(function (r) { return fill(r.check.sumGood, c); })) + '.' : '') +
          '\n\nThe full audit is attached. If it would help to go through it together, I’m happy to do a 15-minute call — just reply with a time that suits. No obligation either way, and the list is yours to use however you like.' + sig });
      s.push({ key: 'follow', name: 'Follow-up (4 days later)', subject: 'Re: Your free audit — ' + biz,
        body: hi + ',\n\nJust checking the audit came through and made sense. If you only do one thing from it, make it this one' +
          (quick && quick.check.effort === 1 ? ' — it’s an afternoon’s work' : '') + ': ' + (quick ? fixClause(quick, c) : 'the first fix on the list.') +
          '\n\nHappy to answer any questions, or to walk through it on a quick call.' + sig });
    } else {
      s.push({ key: 'email', name: 'Cold email',
        subject: 'Quick idea for ' + biz + '   ·   alt: ' + biz + ' — ' + count + ' things I noticed   ·   alt: Something on ' + biz + '’s ' + areaWord,
        body: hi + ',\n\nI was looking at ' + biz + ' online this week — I liked ' + good + '. One thing stood out, though: ' + seen + '.\n\n' +
          (top ? fill(top.check.issue(c).why, c) + '\n\n' : '') +
          'I put together a short audit of ' + biz + '’s website, Google profile and social with ' + count + ' specific fixes' +
          (quick && quick.check.effort === 1 ? ' — the first takes an afternoon' : '') + '. Happy to send it over, free, no pitch attached.\n\nWant me to send it?' + sig +
          '\n\nIf this isn’t useful, just reply “no thanks” and I won’t follow up.' });
      s.push({ key: 'follow', name: 'Follow-up (4 days later)', subject: 'Re: Quick idea for ' + biz,
        body: hi + ',\n\nFollowing up in case this got buried. The audit for ' + biz + ' is ready' +
          (quick ? '. The quickest fix on it' + (quick.check.effort === 1 ? ' takes an afternoon' : '') + ': ' + fixClause(quick, c) : '.') +
          '\n\nShall I send it? If not, no problem — I won’t keep chasing.' + sig });
      s.push({ key: 'dm', name: 'Instagram DM', subject: '',
        body: (first ? 'Hi ' + first + '! ' : 'Hi! ') + 'Love ' + good + '. I run a small studio that helps local businesses like yours' +
          ' with their websites, Google and content, and I noticed ' + seen + '. I put together a quick free audit of ' + biz + ' with a few fixes — want me to send it over?' });
      s.push({ key: 'call', name: 'Call opener', subject: '',
        body: '“Hi, is this ' + (first || '[name]') + '? This is Phillip with Walsh Digital Co. — I’ll be quick.\n\nI was looking at ' + biz + ' online and noticed ' + seen +
          '. I’ve put together a short audit with ' + count + ' fixes, no charge. Would it be all right if I emailed it over?”\n\n→ Yes: “Great — what’s the best address?” Confirm the email, say it’ll arrive today, and ask whether a 15-minute walkthrough later this week would help.\n→ Busy: “No problem — I’ll email it and you can look whenever. Is ' + (c.p.email || '[email]') + ' still right?”' });
      s.push({ key: 'vm', name: 'Voicemail', subject: '',
        body: 'Hi ' + (first || 'there') + ', it’s Phillip Walsh from Walsh Digital Co. I was looking at ' + biz + '’s ' + areaWord + ' and spotted ' + count +
          ' things that are probably costing you ' + c.ind.customers + ' — the first is a quick fix. I’ve written them up for free and I’ll email it over, or call me back on ' + STUDIO.phone + '. Again, Phillip, ' + STUDIO.phone + '. Thanks!' });
    }
    return s;
  }

  function callPrep(c, rk, rec) {
    var I = rk.issues, out = [];
    if (I[0]) out.push(['Lead with', fill(I[0].check.issue(c).title, c) + '. ' + fill(I[0].check.issue(c).why, c)]);
    if (I[1]) out.push(['Then', fill(I[1].check.issue(c).title, c) + '.']);
    var S = strengths(c, rk);
    if (S[0]) out.push(['Give credit for', U.cap(fill(S.slice(0, 2).map(function (r) { return r.check.sumGood; }).join(' and '), c)) + ' — say it first, and mean it.']);
    if (c.p.notes) out.push(['Their words / notes', c.p.notes]);
    if (rec && rec.name) out.push(['Recommend', rec.name + ' at $' + rec.price + '/mo — ' + rec.line + '.' + (rec.alt ? ' Fallback: ' + rec.alt + '.' : '')]);
    out.push(['“We get enough from word of mouth.”', 'Word of mouth is exactly who looks you up before calling' + (I[0] ? ' — and right now they find that ' + fill(I[0].check.sumBad, c) + '.' : '.')]);
    out.push(['“I already have a web person.”', 'Then the audit’s yours to hand to them. Most of the gaps are in Google and social, which usually sit with nobody.']);
    out.push(['“It’s too expensive.”', 'Foundation is $199/mo with the website included and no setup fee, month to month. Or start with only the part that’s missing.']);
    out.push(['“Not right now.”', 'Completely fine — keep the audit. The quick wins on it take an afternoon, and I’ll check back in a couple of months.']);
    return out;
  }

  /* ── report ─────────────────────────────────────────── */
  function render() {
    var c = evaluate(), sc = scores(c), rk = rank(c);
    var sum = summary(c, rk, sc), rec = recommend(c, rk, sc), scripts = outreach(c, rk, sc, sum, rec), prep = callPrep(c, rk, rec);
    renderChecks(c);
    renderStatus();
    var doc = $('#doc');
    var date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    var meta = [U.cap(c.trade), c.p.location, c.p.contact ? 'Prepared for ' + c.p.contact : '', date].filter(Boolean);
    var h = '';

    h += '<header class="doc-head"><div class="doc-brand"><span>Walsh Digital Co.</span><span>Digital presence audit</span></div>' +
         '<h1>' + esc(c.p.business || 'New prospect') + '</h1><p class="doc-meta">' + meta.map(esc).join(' &middot; ') + '</p></header>';

    // 01 summary
    h += sec('01', 'Executive summary', 'summary',
      sum ? '<p class="doc-sum">' + esc(sum) + '</p>'
          : '<p class="doc-empty">Scan the website or mark a few checks and the summary writes itself.</p>');

    // 02 scorecard
    var ob = band(sc.overall);
    var bars = D.AREAS.map(function (a) {
      var s = sc[a.key], b = band(s.score);
      return '<div class="bar bar--' + b.cls + '"><span class="bar-l">' + esc(a.name) + '</span>' +
        '<span class="bar-t"><i style="width:' + (s.score || 0) + '%"></i></span>' +
        '<span class="bar-v">' + (s.score == null ? '—' : s.score) + '</span></div>';
    }).join('');
    h += sec('02', 'Scorecard', 'score',
      '<div class="score"><div class="ring ring--' + ob.cls + '" style="--v:' + (sc.overall || 0) + '"><b>' + (sc.overall == null ? '—' : sc.overall) + '</b><small>of 100</small></div>' +
      '<div><p class="score-word">' + esc(ob.word) + '</p><div class="bars">' + bars + '</div>' +
      '<p class="doc-note doc-internal">Based on ' + sc.assessed + ' of ' + sc.total + ' checks. Weighted by how much each one affects whether people become customers.</p></div></div>');

    // 03–06 areas
    var nums = ['03', '04', '05', '06'];
    D.AREAS.forEach(function (a, i) {
      var rows = D.CHECKS.filter(function (k) { return k.area === a.key && c.res[k.id].status !== 'skip'; })
        .map(function (k) { return c.res[k.id]; });
      var iss = rk.issues.filter(function (r) { return r.check.area === a.key; });
      var ok = rows.filter(function (r) { return r.status === 'good'; });
      var unk = rows.filter(function (r) { return r.status === 'unknown'; });
      var body = '';
      iss.forEach(function (r) {
        var x = r.check.issue(c);
        body += '<div class="fd fd--issue"><span class="pill pill--bad">Fix</span><div><h4>' + esc(fill(x.title, c)) + '</h4>' +
          (r.evidence ? '<p class="fd-ev">What we saw: ' + esc(r.evidence) + '</p>' : '') +
          '<p><strong>Why it matters.</strong> ' + esc(fill(x.why, c)) + '</p><p><strong>The fix.</strong> ' + esc(fill(x.fix, c)) + '</p></div></div>';
      });
      if (ok.length) body += '<div class="fd fd--ok"><span class="pill pill--ok">Working</span><div><ul>' +
        ok.map(function (r) { return '<li>' + esc(fill(r.check.good(c), c)) + (r.evidence ? ' <span class="fd-ev">(' + esc(r.evidence) + ')</span>' : '') + '</li>'; }).join('') + '</ul></div></div>';
      if (unk.length) body += '<div class="fd fd--unk doc-internal"><span class="pill pill--na">Not checked</span><div><ul>' +
        unk.map(function (r) { return '<li>' + esc(r.check.label(c)) + (r.evidence ? ' <span class="fd-ev">— ' + esc(r.evidence) + '</span>' : '') + '</li>'; }).join('') + '</ul></div></div>';
      if (!iss.length && !ok.length) body = '<p class="doc-empty">Nothing assessed here yet.</p>' + body;
      h += sec(nums[i], a.name + ' audit', a.key, body, !iss.length && !ok.length);
    });

    // 07 opportunities
    var top3 = rk.issues.slice(0, 3);
    var quick = rk.issues.slice(3).filter(function (r) { return r.check.effort === 1; }).slice(0, 4);
    var big = rk.issues.slice(3).filter(function (r) { return r.check.effort === 3; });
    var ob7 = top3.length ? '<ol class="opps">' + top3.map(function (r) {
        var x = r.check.issue(c);
        return '<li><b>' + esc(U.cap(fill(r.check.opp(c), c))) + '</b><span>' + esc(fill(x.fix, c)) + '</span><em>' +
          ['', 'An afternoon', 'A few weeks', 'A project'][r.check.effort] + ' &middot; ' + ['', 'Helpful', 'Important', 'High impact'][r.check.impact] + '</em></li>';
      }).join('') + '</ol>' : '<p class="doc-empty">No issues marked yet.</p>';
    if (quick.length) ob7 += '<p class="doc-h3">Also quick to fix</p><ul class="doc-list">' + quick.map(function (r) { return '<li>' + esc(fill(r.check.issue(c).title, c)) + '</li>'; }).join('') + '</ul>';
    if (big.length) ob7 += '<p class="doc-h3">Bigger plays</p><ul class="doc-list">' + big.map(function (r) { return '<li>' + esc(fill(r.check.issue(c).title, c)) + '</li>'; }).join('') + '</ul>';
    h += sec('07', 'Where to start', 'opps', ob7);

    // 08 recommendation
    var b8;
    if (!rec) b8 = '<p class="doc-empty">Needs at least five assessed checks.</p>';
    else if (!rec.name) b8 = '<p>' + esc(rec.why[0]) + '</p>';
    else b8 = '<div class="rec"><div class="rec-p"><b>' + rec.name + '</b><span>$' + rec.price + '/month &middot; month to month</span></div>' +
      '<div><p>' + esc(U.cap(rec.line)) + '.</p>' + (rec.why.length ? '<p class="doc-h3">What it takes care of here</p><ul class="doc-list">' +
      rec.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
      (rec.note ? '<p class="doc-note">' + esc(rec.note) + '</p>' : '') +
      (rec.alt ? '<p class="doc-note doc-internal">Fallback: ' + esc(rec.alt) + '.</p>' : '') + '</div></div>';
    h += sec('08', 'Recommended plan', 'plan', b8);

    // 09 outreach (internal)
    var tabs = scripts.map(function (s, i) {
      return '<button type="button" class="tab' + (i === 0 ? ' on' : '') + '" data-tab="' + s.key + '">' + esc(s.name) + '</button>';
    }).join('');
    var panes = scripts.map(function (s, i) {
      return '<div class="pane" data-pane="' + s.key + '"' + (i === 0 ? '' : ' hidden') + '>' +
        (s.subject ? '<p class="subj"><span>Subject</span>' + esc(s.subject) + '</p>' : '') +
        '<pre class="script" id="script-' + s.key + '">' + esc(s.body) + '</pre>' +
        '<button type="button" class="dk-btn dk-btn--sm" data-copy-script="' + s.key + '">Copy</button></div>';
    }).join('');
    h += sec('09', st.source === 'inbound' ? 'Reply kit' : 'Outreach kit', 'outreach',
      '<div class="tabs" role="tablist">' + tabs + '</div>' + panes +
      (st.source === 'outbound' ? '<p class="doc-note">Cold email is commercial email: keep the opt-out line and add the studio’s postal address before sending (CAN-SPAM).</p>' : ''), false, true);

    // 10 call prep (internal)
    h += sec('10', 'Call prep', 'prep', '<dl class="prep">' + prep.map(function (p) {
      return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') + '</dl>', false, true);

    h += '<footer class="doc-foot"><b>Want help with any of this?</b><span>' + STUDIO.name + ' &middot; ' + STUDIO.company +
         ' &middot; ' + STUDIO.site + ' &middot; ' + STUDIO.phone + '</span></footer>';

    var keep = doc.querySelector('.tab.on');
    var keepKey = keep && keep.dataset.tab;
    doc.innerHTML = h;
    if (keepKey && doc.querySelector('[data-tab="' + keepKey + '"]')) showTab(keepKey);
    doc.dataset.view = view;
    last = { c: c, sc: sc, rk: rk, sum: sum, rec: rec, scripts: scripts, prep: prep };
    $('#dkScore').textContent = sc.overall == null ? '—' : sc.overall;
  }
  var last = null;

  function sec(n, title, key, body, empty, internal) {
    return '<section class="doc-sec' + (internal ? ' doc-internal' : '') + (empty ? ' doc-unassessed' : '') + '" data-sec="' + key + '">' +
      '<h2><span>' + n + '</span>' + esc(title) + '</h2>' + body + '</section>';
  }
  function showTab(key) {
    $$('#doc .tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === key); });
    $$('#doc .pane').forEach(function (p) { p.hidden = p.dataset.pane !== key; });
  }

  /* plain text of the client-facing audit, for pasting into an email or doc */
  function plainAudit() {
    var L = last, c = L.c, t = [];
    t.push('DIGITAL PRESENCE AUDIT — ' + (c.p.business || '').toUpperCase());
    t.push([U.cap(c.trade), c.p.location, 'Walsh Digital Co.'].filter(Boolean).join(' · '), '');
    t.push('EXECUTIVE SUMMARY', L.sum || '(not enough checks yet)', '');
    t.push('SCORE: ' + (L.sc.overall == null ? '—' : L.sc.overall + '/100 (' + band(L.sc.overall).word + ')'));
    D.AREAS.forEach(function (a) { t.push('  ' + a.name + ': ' + (L.sc[a.key].score == null ? '—' : L.sc[a.key].score)); });
    D.AREAS.forEach(function (a) {
      var iss = L.rk.issues.filter(function (r) { return r.check.area === a.key; });
      var ok = L.rk.goods.filter(function (r) { return r.check.area === a.key; });
      if (!iss.length && !ok.length) return;
      t.push('', a.name.toUpperCase());
      iss.forEach(function (r) {
        var x = r.check.issue(c);
        t.push('✕ ' + fill(x.title, c));
        if (r.evidence) t.push('  What we saw: ' + r.evidence);
        t.push('  Why it matters: ' + fill(x.why, c), '  The fix: ' + fill(x.fix, c));
      });
      ok.forEach(function (r) { t.push('✓ ' + fill(r.check.good(c), c)); });
    });
    t.push('', 'WHERE TO START');
    L.rk.issues.slice(0, 3).forEach(function (r, i) { t.push((i + 1) + '. ' + U.cap(fill(r.check.opp(c), c)) + ' — ' + fill(r.check.issue(c).fix, c)); });
    if (L.rec && L.rec.name) t.push('', 'RECOMMENDED PLAN', L.rec.name + ' — $' + L.rec.price + '/month: ' + L.rec.line + '.');
    t.push('', STUDIO.name + ' · ' + STUDIO.company + ' · ' + STUDIO.site + ' · ' + STUDIO.phone);
    return t.join('\n');
  }

  /* ── input panel: check rows ─────────────────────────── */
  function buildChecks() {
    D.AREAS.forEach(function (a) {
      var wrap = $('#checks-' + a.key);
      D.CHECKS.filter(function (k) { return k.area === a.key; }).forEach(function (k) {
        var row = document.createElement('div');
        row.className = 'ck';
        row.dataset.id = k.id;
        row.innerHTML = '<div class="ck-l"><span class="ck-t"></span><span class="ck-ev"></span></div>' +
          '<div class="ck-b" role="group">' +
          '<button type="button" data-v="good" title="Good">✓</button>' +
          '<button type="button" data-v="issue" title="Needs work">✕</button>' +
          '<button type="button" data-v="na" title="Not checked / not relevant">–</button></div>';
        wrap.appendChild(row);
      });
    });
    $('#dkIn').addEventListener('click', function (e) {
      var b = e.target.closest('.ck-b button');
      if (!b) return;
      var id = b.closest('.ck').dataset.id, v = b.dataset.v;
      if (st.obs[id] === v) delete st.obs[id]; else st.obs[id] = v;
      changed();
    });
  }
  function renderChecks(c) {
    $$('.ck').forEach(function (row) {
      var r = c.res[row.dataset.id];
      row.hidden = !r.applies;
      $('.ck-t', row).textContent = r.check.label(c);
      $('.ck-ev', row).textContent = r.evidence || '';
      row.dataset.state = r.status;
      row.classList.toggle('is-auto', !r.manual && !!r.auto);
      row.classList.toggle('is-manual', !!r.manual);
      $$('button', row).forEach(function (b) {
        var on = r.manual ? b.dataset.v === r.manual : (r.auto && b.dataset.v === r.auto);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $('.ck-b', row).setAttribute('aria-label', r.check.label(c));
    });
    D.AREAS.forEach(function (a) {
      var rows = D.CHECKS.filter(function (k) { return k.area === a.key && c.res[k.id].applies; });
      var done = rows.filter(function (k) { return c.res[k.id].status === 'good' || c.res[k.id].status === 'issue'; }).length;
      var el = $('#count-' + a.key);
      if (el) el.textContent = done + '/' + rows.length;
    });
  }

  /* ── bindings ─────────────────────────────────────── */
  function get(path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, st); }
  function set(path, v) { var ks = path.split('.'), o = st; ks.slice(0, -1).forEach(function (k) { o = o[k]; }); o[ks[ks.length - 1]] = v; }
  function syncInputs() {
    $$('[data-bind]').forEach(function (el) { var v = get(el.dataset.bind); el.value = v == null ? '' : v; });
    $$('[name=source]').forEach(function (r) { r.checked = r.value === st.source; });
  }
  var timer = null;
  function changed() {
    st.updated = Date.now();
    clearTimeout(timer);
    timer = setTimeout(function () { render(); store(LS_DRAFT, st); }, 90);
  }

  function renderStatus() {
    var s = $('#scanOut');
    if (st.scanError) s.innerHTML = '<span class="bad">' + esc(st.scanError) + '</span>';
    else if (st.scan) {
      var f = st.scan.fetched, t = st.scan.tech, so = st.scan.socials, bits = [];
      bits.push(f.url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
      if (t.platform) bits.push(t.platform);
      bits.push(Math.round(f.bytes / 1024) + ' KB');
      if (so.instagram[0]) bits.push('IG @' + so.instagram[0]);
      if (so.tiktok[0]) bits.push('TikTok @' + so.tiktok[0]);
      if (st.scan.content.thin) bits.push('very little text — may be built with JavaScript, so check by eye');
      s.innerHTML = '<span class="ok">Scanned</span> ' + esc(bits.join(' · '));
    } else s.textContent = '';
    var p = $('#placesOut');
    if (st.placesError) p.innerHTML = '<span class="bad">' + esc(st.placesError) + '</span>';
    else if (st.places) p.innerHTML = '<span class="ok">Found</span> ' + esc(st.places.name + ' · ' + (st.places.address || '')) +
      (st.places.mapsUrl ? ' · <a href="' + esc(st.places.mapsUrl) + '" target="_blank" rel="noopener">open</a>' : '') +
      ' · <button type="button" class="linkish" id="placesClear">not them</button>';
    else p.textContent = '';
    var sp = $('#speedOut');
    if (st.speedError) sp.innerHTML = '<span class="bad">' + esc(st.speedError) + '</span>';
    else if (st.speed) sp.innerHTML = '<span class="ok">Mobile ' + st.speed.score + '/100</span> ' + esc([st.speed.lcp && 'LCP ' + st.speed.lcp, st.speed.cls && 'CLS ' + st.speed.cls].filter(Boolean).join(' · '));
    else sp.textContent = '';
    $('#dkKeyWarn').hidden = !!store(LS_KEY);
  }

  /* ── automatic checks ─────────────────────────────── */
  function api(path, payload) {
    var key = store(LS_KEY) || '';
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-desk-key': key }, body: JSON.stringify(payload) })
      .then(function (r) {
        return r.text().then(function (txt) {
          var j = null; try { j = JSON.parse(txt); } catch (e) {}
          if (r.status === 404 || (!j && r.ok)) throw new Error('The desk API isn’t available here — it runs on the deployed site (Vercel). Fill the checks by hand, or open the desk on walshdigitalco.com.');
          if (!r.ok) throw new Error((j && j.message) || 'Request failed (' + r.status + ').');
          return j;
        });
      }, function () { throw new Error('Couldn’t reach the desk API — check your connection.'); });
  }
  function busy(btn, on) { btn.disabled = on; btn.classList.toggle('is-busy', on); }

  function runScan() {
    var btn = $('#btnScan');
    if (!st.p.website) { st.scanError = 'Add a website address first.'; render(); return Promise.resolve(); }
    busy(btn, true); st.scanError = null;
    $('#scanOut').textContent = 'Scanning…';
    return api('/api/scan', { url: st.p.website, city: st.p.location, business: st.p.business }).then(function (j) {
      st.scan = j;
      if (!j.ok) st.scanError = 'The site answered with status ' + j.fetched.status + '.';
      // fill social handles the site links to, if we didn't have them
      if (!st.p.instagram && j.socials.instagram[0]) st.p.instagram = '@' + j.socials.instagram[0];
      if (!st.p.tiktok && j.socials.tiktok[0]) st.p.tiktok = '@' + j.socials.tiktok[0];
      if (!st.p.gbp && j.socials.google[0]) st.p.gbp = j.socials.google[0];
      syncInputs();
    }).catch(function (e) { st.scan = null; st.scanError = e.message; })
      .then(function () { busy(btn, false); changed(); });
  }

  function daysToSelect(d) { return d == null ? '' : d <= 30 ? '30' : d <= 90 ? '90' : d <= 180 ? '180' : d <= 365 ? '365' : '999'; }
  function runPlaces() {
    var btn = $('#btnPlaces');
    if (!st.p.business) { st.placesError = 'Add the business name first.'; render(); return Promise.resolve(); }
    busy(btn, true); st.placesError = null;
    $('#placesOut').textContent = 'Looking up…';
    return api('/api/places', { business: st.p.business, location: st.p.location }).then(function (j) {
      var p = j.candidates[0];
      if (!p) { st.places = null; st.placesError = 'No Google profile found for “' + j.query + '”. Check by hand before marking it missing.'; return; }
      st.places = p;
      st.g.rating = p.rating == null ? '' : p.rating;
      st.g.reviews = p.reviews;
      st.g.lastReview = daysToSelect(p.latestReviewDays);
      st.g.photos = p.photos;
      if (!st.p.gbp && p.mapsUrl) st.p.gbp = p.mapsUrl;
      if (!st.p.phone && p.phone) st.p.phone = p.phone;
      if (!st.p.website && p.website) st.p.website = p.website;
      syncInputs();
    }).catch(function (e) { st.placesError = e.message; })
      .then(function () { busy(btn, false); changed(); });
  }

  function runSpeed() {
    var btn = $('#btnSpeed');
    if (!st.p.website) { st.speedError = 'Add a website address first.'; render(); return Promise.resolve(); }
    busy(btn, true); st.speedError = null;
    $('#speedOut').textContent = 'Testing on a simulated phone — this takes 20–40 seconds…';
    var url = /^https?:\/\//i.test(st.p.website) ? st.p.website : 'https://' + st.p.website;
    var psi = store(LS_PSI);
    return fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&category=performance&url=' +
        encodeURIComponent(url) + (psi ? '&key=' + encodeURIComponent(psi) : ''))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error && j.error.message || 'Speed test failed.'); return j; }); })
      .then(function (j) {
        var lh = j.lighthouseResult, a = lh.audits;
        st.speed = { score: Math.round(lh.categories.performance.score * 100),
          lcp: a['largest-contentful-paint'] && a['largest-contentful-paint'].displayValue,
          cls: a['cumulative-layout-shift'] && a['cumulative-layout-shift'].displayValue, at: Date.now() };
      }).catch(function (e) {
        st.speedError = /quota/i.test(e.message) ? 'Google’s free speed-test quota is used up — add a PageSpeed API key in Settings.' : e.message;
      }).then(function () { busy(btn, false); changed(); });
  }

  /* ── saved prospects ──────────────────────────────── */
  function saved() { return store(LS_SAVED) || []; }
  function saveCurrent() {
    var list = saved().filter(function (x) { return x.id !== st.id; });
    list.unshift(JSON.parse(JSON.stringify(st)));
    store(LS_SAVED, list.slice(0, 200));
    toast('Saved ' + (st.p.business || 'prospect'));
    renderSaved();
  }
  function renderSaved() {
    var list = saved(), el = $('#savedList');
    $('#dkSavedN').textContent = list.length;
    if (!list.length) { el.innerHTML = '<p class="doc-empty">Nothing saved yet.</p>'; return; }
    el.innerHTML = list.map(function (x) {
      return '<li><div><b>' + esc(x.p.business || 'Untitled') + '</b><span>' + esc([x.p.location, x.source === 'inbound' ? 'Inbound' : 'Outbound',
        new Date(x.updated).toLocaleDateString()].filter(Boolean).join(' · ')) + '</span></div>' +
        '<button type="button" class="dk-btn dk-btn--sm" data-load="' + x.id + '">Open</button>' +
        '<button type="button" class="dk-btn dk-btn--sm dk-btn--ghost" data-del="' + x.id + '" aria-label="Delete">✕</button></li>';
    }).join('');
  }
  function load(obj) {
    st = Object.assign(blank(), obj);
    ['p', 'g', 'ig', 'tt'].forEach(function (k) { st[k] = Object.assign(blank()[k], obj[k] || {}); });
    st.obs = obj.obs || {};
    syncInputs(); render(); store(LS_DRAFT, st);
  }

  function toast(msg) {
    var t = $('#dkToast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2200);
  }
  function copy(text, label) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast((label || 'Copied') + ' ✓'); },
      function () {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast((label || 'Copied') + ' ✓'); } catch (e) { toast('Copy failed — select and copy by hand'); }
        ta.remove();
      });
  }

  /* ── a lead from the public audit form: #lead=<base64url json> ── */
  function takeLead() {
    var m = location.hash.match(/#lead=([A-Za-z0-9_-]+)/);
    if (!m) return;
    try {
      var b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      var L = JSON.parse(decodeURIComponent(escape(atob(b64))));
      var existing = saved().filter(function (x) { return x.leadEmail && x.leadEmail === L.email && x.p.business === L.business; })[0];
      if (existing) { load(existing); toast('Opened the saved audit for ' + L.business); }
      else {
        var s = blank();
        s.source = 'inbound'; s.leadEmail = L.email;
        s.p.business = L.business || ''; s.p.website = L.website || ''; s.p.instagram = L.instagram || ''; s.p.tiktok = L.tiktok || '';
        s.p.industry = D.SITE_INDUSTRY[L.industry] || 'other'; s.p.location = L.city || '';
        s.p.contact = L.name || ''; s.p.email = L.email || ''; s.p.phone = L.phone || '';
        s.p.notes = ['Inbound free audit request.', L.struggles && L.struggles.length ? 'Struggling with: ' + L.struggles.join('; ') + '.' : '',
                     L.message ? 'Their note: ' + L.message : ''].filter(Boolean).join(' ');
        load(s);
        toast('Loaded the audit request from ' + (L.name || L.business));
      }
    } catch (e) { toast('That lead link couldn’t be read'); }
    history.replaceState(null, '', location.pathname);
  }

  /* ── wire up ──────────────────────────────────────── */
  function init() {
    buildChecks();
    syncInputs();

    $('#dkIn').addEventListener('input', function (e) {
      var el = e.target;
      if (el.dataset.bind) { set(el.dataset.bind, el.value); if (el.dataset.bind === 'p.website') { st.scan = null; st.scanError = null; st.speed = null; } changed(); }
      if (el.name === 'source') { st.source = el.value; changed(); }
    });
    $('#btnScan').addEventListener('click', runScan);
    $('#btnPlaces').addEventListener('click', runPlaces);
    $('#btnSpeed').addEventListener('click', runSpeed);
    $('#btnAll').addEventListener('click', function () {
      var jobs = [];
      if (st.p.website) jobs.push(runScan());
      if (st.p.business) jobs.push(runPlaces());
      Promise.all(jobs).then(function () { if (st.p.website) runSpeed(); });
    });
    $('#dkIn').addEventListener('click', function (e) {
      if (e.target.id === 'placesClear') {
        st.places = null; st.g = blank().g; syncInputs(); changed();
      }
    });

    $('#doc').addEventListener('click', function (e) {
      var t = e.target.closest('.tab');
      if (t) return showTab(t.dataset.tab);
      var cs = e.target.closest('[data-copy-script]');
      if (cs) {
        var s = last.scripts.filter(function (x) { return x.key === cs.dataset.copyScript; })[0];
        copy((s.subject ? 'Subject: ' + s.subject.split('   ·   ')[0] + '\n\n' : '') + s.body, s.name + ' copied');
      }
    });

    $('#btnView').addEventListener('click', function () {
      view = view === 'internal' ? 'client' : 'internal';
      $('#doc').dataset.view = view;
      this.textContent = view === 'internal' ? 'Show client view' : 'Show internal view';
      this.setAttribute('aria-pressed', view === 'client' ? 'true' : 'false');
    });
    $('#btnCopySum').addEventListener('click', function () { copy(last.sum || '', 'Summary copied'); });
    $('#btnCopyAll').addEventListener('click', function () { copy(plainAudit(), 'Audit copied'); });
    $('#btnPrint').addEventListener('click', function () {
      var t = document.title;
      document.title = 'Audit — ' + (st.p.business || 'prospect') + ' — Walsh Digital Co.';
      window.print();
      document.title = t;
    });
    $('#btnSave').addEventListener('click', saveCurrent);
    $('#btnNew').addEventListener('click', function () {
      if (st.p.business && !confirm('Start a new prospect? Unsaved changes to ' + st.p.business + ' will be lost (save first to keep them).')) return;
      load(blank());
    });

    var dlgSaved = $('#dlgSaved'), dlgSet = $('#dlgSettings');
    $('#btnSaved').addEventListener('click', function () { renderSaved(); dlgSaved.showModal(); });
    $('#savedList').addEventListener('click', function (e) {
      var l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
      if (l) { load(saved().filter(function (x) { return x.id === l.dataset.load; })[0]); dlgSaved.close(); }
      if (d && confirm('Delete this saved audit?')) { store(LS_SAVED, saved().filter(function (x) { return x.id !== d.dataset.del; })); renderSaved(); }
    });
    $('#btnExport').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(saved(), null, 2)], { type: 'application/json' }));
      a.download = 'wdc-audits-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    $('#fileImport').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var inc = JSON.parse(txt), list = saved(), ids = list.map(function (x) { return x.id; });
        (Array.isArray(inc) ? inc : [inc]).forEach(function (x) { if (x && x.p && ids.indexOf(x.id) < 0) list.push(x); });
        store(LS_SAVED, list); renderSaved(); toast('Imported');
      }).catch(function () { toast('That file isn’t a desk export'); });
      this.value = '';
    });
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });

    $('#btnSettings').addEventListener('click', function () {
      $('#setKey').value = store(LS_KEY) || ''; $('#setPsi').value = store(LS_PSI) || ''; dlgSet.showModal();
    });
    $('#formSettings').addEventListener('submit', function () {
      store(LS_KEY, $('#setKey').value.trim()); store(LS_PSI, $('#setPsi').value.trim()); render(); toast('Settings saved');
    });
    $('#dkKeyWarn').addEventListener('click', function () { $('#btnSettings').click(); });

    window.addEventListener('hashchange', takeLead);
    takeLead();
    render();
    renderSaved();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
