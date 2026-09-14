/* Walsh Digital Co. — shared behaviour */
(function () {
  'use strict';

  /* Every form on the site posts to Web3Forms, which emails the submission to
     hello@walshdigitalco.com. The access key is public by design — lock it to
     walshdigitalco.com + www in the Web3Forms dashboard so nobody else can use it. */
  var WEB3FORMS_URL = 'https://api.web3forms.com/submit';
  var WEB3FORMS_KEY = '941a7e49-3f26-4823-942e-e44be4cab380';

  /* ── nav: fix on scroll + mobile menu ─────────────── */
  var nav = document.querySelector('.nav');
  var burger = document.querySelector('.burger');
  var menu = document.querySelector('.menu');

  if (nav && nav.dataset.fixed !== 'always') {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('is-fixed', window.scrollY > 40);
    }, { passive: true });
  }

  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── the film: one scroll progress, four acts ──────────
     0.00–0.06  hold on frame one, headline in
     0.06–0.66  the film scrubs to its end
     0.60–0.70  cross-fade into the dated site (crisp HTML)
     0.70–      the reveal offer appears
     0.80–1.00  the wipe — or a click jumps straight to it   */
  var film = document.getElementById('film');
  if (film) {
    var vid = document.getElementById('filmVid');
    var revealBtn = document.getElementById('filmReveal');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var revealed = false, fTick = false, vidReady = false, autoPlaying = false, playedOut = false;

    /* phones get the poster frame and nothing else. The clip only earns its
       2.5MB where it is actually scrubbed, so on a phone we never fetch it:
       preload="none" in the markup keeps the browser from starting, and the
       <video> renders its poster until something asks it to play. */
    var noVideo = reduce || window.innerWidth <= 920;

    function sub(p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); }
    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function filmFrame() {
      fTick = false;
      if (window.innerWidth <= 920 || reduce) {          // stacked, nothing driven
        film.style.removeProperty('--copyIn');
        film.style.removeProperty('--baIn');
        film.style.removeProperty('--p');
        film.classList.remove('can-reveal', 'ba-live', 'is-after');
        return;
      }
      var rect = film.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var prog = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      var copyIn = 1 - sub(prog, 0.06, 0.17);
      film.style.setProperty('--copyIn', copyIn.toFixed(3));
      film.classList.toggle('copy-gone', copyIn < 0.05);

      // scrolling back up hands control to the scrub again
      if (prog < 0.60) playedOut = false;

      // scrub on manual scroll — but never while the film is playing itself, and
      // never once it has played through. both cases end with the scrub and the
      // playback fighting over currentTime, which drops the picture back to frame
      // one at exactly the moment the reveal is being offered.
      if (vidReady && vid.duration && !autoPlaying && !playedOut) {
        var vt = sub(prog, 0.06, 0.66) * (vid.duration - 0.05);
        if (Math.abs(vid.currentTime - vt) > 0.02) {
          try { vid.currentTime = vt; } catch (e) {}
        }
      }

      var baIn = sub(prog, 0.60, 0.70);
      film.style.setProperty('--baIn', baIn.toFixed(3));
      film.classList.toggle('ba-live', baIn > 0);

      var p = revealed ? 1 : ease(sub(prog, 0.80, 1.0));
      // offer the click only while there is still something to reveal
      film.classList.toggle('can-reveal', prog > 0.70 && !revealed && p < 0.04);
      film.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      film.classList.toggle('is-after', p > 0.5);
    }

    /* readiness has to be latched from several angles. with preload="auto" and a
       warm cache, loadedmetadata can fire before this script is parsed — the lone
       readyState check that used to back it up runs in the same tick and can still
       read 0, leaving vidReady false for good and the film never scrubbing at all. */
    if (vid && !noVideo) {
      vid.preload = 'auto';            // markup says "none" so phones stay clean
      var markReady = function () {
        if (vidReady) return;
        vidReady = true;
        filmFrame();
      };
      ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough'].forEach(function (ev) {
        vid.addEventListener(ev, markReady);
      });
      if (vid.readyState >= 1) markReady();
      else vid.load();                 // nudge a source that never began loading
    }
    /* "Watch the transformation" — let the film play and have the page follow it.
       This used to inch the scroll along an ease-in-out cubic and let the scrub
       seek from there, which stuttered badly: every currentTime assignment decodes
       from the nearest keyframe, and at one seek per frame the seeks queue up until
       the picture looks frozen. It also opened almost flat — about 4px in the first
       second — so nothing visibly happened for nearly three seconds after the click.
       Playing is the one thing a decoder is quick at, so now the video drives and
       the scroll tracks it. Any real input from the visitor cancels it. */
    var playBtn = document.getElementById('filmPlay');
    if (playBtn) {
      var auto = null;
      function stopAuto() {
        auto = null;
        if (autoPlaying) { autoPlaying = false; try { vid.pause(); } catch (e) {} }
      }
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
        window.addEventListener(ev, function (e) {
          if (auto && !(e.target && e.target.closest && e.target.closest('.film-play'))) stopAuto();
        }, { passive: true });
      });

      function filmTop()  { return film.getBoundingClientRect().top + window.pageYOffset; }
      function filmSpan() { return film.offsetHeight - window.innerHeight; }
      // where the page should sit for a given moment of the film
      function yForTime(t) {
        var frac = vid.duration ? t / (vid.duration - 0.05) : 0;
        return filmTop() + filmSpan() * (0.06 + Math.min(1, Math.max(0, frac)) * 0.60);
      }
      // short eased move, used to open and to close — starts immediately, unlike
      // the cubic ease-in it replaces
      function glide(to, ms, then) {
        var from = window.pageYOffset, t0 = null, mine = auto;
        requestAnimationFrame(function step(ts) {
          if (auto !== mine) return;
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / ms);
          window.scrollTo(0, from + (to - from) * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step); else if (then) then();
        });
      }
      function toReveal() {
        autoPlaying = false;
        playedOut = true;                       // the scrub keeps its hands off from here
        try { vid.pause(); } catch (e) {}       // 'ended' does not always fire, so pause outright
        glide(filmTop() + filmSpan() * 0.76, 1400, stopAuto);
      }
      function runFilm() {
        var mine = auto;
        autoPlaying = true;
        var p = vid.play();
        if (p && p.catch) p.catch(function () { autoPlaying = false; stopAuto(); });
        requestAnimationFrame(function step() {
          if (auto !== mine) return;
          window.scrollTo(0, yForTime(vid.currentTime));
          if (vid.ended || vid.currentTime >= vid.duration - 0.08) { toReveal(); return; }
          requestAnimationFrame(step);
        });
      }

      playBtn.addEventListener('click', function () {
        auto = {};
        function start() {
          // already watched it through? just go to the reveal
          if (vid.duration && vid.currentTime >= vid.duration - 0.12) { toReveal(); return; }
          // skip the deliberate hold before the film starts, then hand over to playback
          glide(yForTime(vid.currentTime), 420, runFilm);
        }
        if (vid.readyState >= 2) start();
        else vid.addEventListener('canplay', start, { once: true });
      });
    }

    if (revealBtn) {
      revealBtn.addEventListener('click', function () {
        revealed = true;
        film.classList.remove('can-reveal');
        film.classList.add('revealed');
        film.style.setProperty('--p', '100%');
        setTimeout(function () { film.classList.add('is-after'); }, 480);
      });
    }
    window.addEventListener('scroll', function () {
      if (!fTick) { fTick = true; requestAnimationFrame(filmFrame); }
    }, { passive: true });
    window.addEventListener('resize', filmFrame);
    filmFrame();
  }

  /* ── scroll reveals ───────────────────────────────── */
  var rises = [].slice.call(document.querySelectorAll('.rise'));
  if (rises.length) {
    if (!('IntersectionObserver' in window)) {
      rises.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      rises.forEach(function (el) { io.observe(el); });
    }
  }

  /* ── plan finder (industries page only) ─────────────
     two single-choice questions. the second picks the
     plan outright; the first only colours the wording.
     each page feature is its own IIFE so an early return
     from one can never swallow the ones after it.
     ─────────────────────────────────────────────────── */
  (function () {
  var deckTrade = document.getElementById('deckTrade');
  if (!deckTrade) return;

  var TRADES = [
    { key: 'beauty', name: 'Beauty & wellness', extra: 'booking links and service menus' },
    { key: 'auto',   name: 'Automotive',        extra: 'custom quote generation and job galleries' },
    { key: 'home',   name: 'Home services',     extra: 'estimate forms and service-area pages' },
    { key: 'other',  name: 'Something else',    extra: 'the workflow your trade actually runs on' }
  ];
  var LEVELS = [
    { key: 'found', name: 'Just the site and brand',    plan: 'Foundation', price: 199,
      line: 'The presence, built and looked after — without ongoing content.' },
    { key: 'grow',  name: 'Site plus social and video', plan: 'Growth',     price: 499,
      line: 'The studio runs your website, search and social — 15 videos a month.' },
    { key: 'prem',  name: 'Everything, hands-off',      plan: 'Premium',    price: 799,
      line: 'The whole presence handled — 30 videos a month, and ' }
  ];

  var deckLevel = document.getElementById('deckLevel');
  var outEl     = document.getElementById('planOut');
  var emptyEl   = document.getElementById('planEmpty');
  var sendEl    = document.getElementById('planSend');

  var chosen = { trade: null, level: null };

  function money(n) { return '$' + n.toLocaleString('en-US'); }

  /* one deck = one answer, so selecting clears its siblings */
  function makeDeck(deck, items, slot) {
    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="tick" aria-hidden="true">&#10003;</span>' + item.name;
      b.addEventListener('click', function () {
        chosen[slot] = item;
        Array.prototype.forEach.call(deck.children, function (sib) {
          sib.classList.remove('on');
          sib.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('on');
        b.setAttribute('aria-pressed', 'true');
        render();
      });
      deck.appendChild(b);
    });
  }

  makeDeck(deckTrade, TRADES, 'trade');
  makeDeck(deckLevel, LEVELS, 'level');

  function row(label, value, cls) {
    return '<div class="row ' + (cls || '') + '"><span class="l">' + label +
           '</span><span class="v">' + value + '</span></div>';
  }

  function render() {
    var t = chosen.trade, l = chosen.level;

    if (!t || !l) {
      outEl.innerHTML = '';
      emptyEl.style.display = 'block';
      sendEl.setAttribute('href', 'services.html#contact');
      return;
    }
    emptyEl.style.display = 'none';

    /* premium is the only tier that carries trade-specific build work */
    var blurb = l.key === 'prem' ? l.line + t.extra + '.' : l.line;

    outEl.innerHTML =
      row('Business', t.name) +
      row('Recommended', l.plan) +
      row('Your plan', money(l.price) + '/mo', 'total') +
      '<p class="small" style="margin-top:14px">' + blurb + '</p>';

    /* the contact form reads ?plan= and ?trade= — a form beats a mailto: that does
       nothing on a phone without mail set up */
    sendEl.setAttribute('href', 'services.html?plan=' + encodeURIComponent(l.plan) +
      '&trade=' + encodeURIComponent(t.name) + '#contact');
  }

  render();
  })();

  /* ── contact form (plans page only) ─────────────────
     Posts to a form service when one is configured, and
     otherwise falls back to the prefilled mailto the site
     used before — so an unset endpoint is never worse
     than what was here, and never fails silently.
     ─────────────────────────────────────────────────── */
  (function () {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var ENDPOINT = WEB3FORMS_URL;

  /* a plan button further up the page ("Start with Growth") preselects it here */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-plan]');
    if (!a || !form.elements.plan) return;
    form.elements.plan.value = a.getAttribute('data-plan');
  });

  var btn  = document.getElementById('contactSend');
  var note = document.getElementById('contactNote');

  /* arriving from the plan finder on the industries page */
  var q = new URLSearchParams(location.search);
  if (q.get('plan') && form.elements.plan) form.elements.plan.value = q.get('plan');
  if (q.get('trade') && form.elements.message && !form.elements.message.value)
    form.elements.message.value = 'Business type: ' + q.get('trade') + '. ';

  function say(msg, cls) {
    note.textContent = msg;
    note.className = 'ct-note' + (cls ? ' ' + cls : '');
  }
  function val(n) {
    var el = form.elements[n];
    return el && el.value ? el.value.trim() : '';
  }
  function summary() {
    return 'Name: ' + val('name') +
           '\nBusiness: ' + (val('business') || '—') +
           '\nEmail: ' + val('email') +
           '\nPhone: ' + (val('phone') || '—') +
           '\nInterested in: ' + val('plan') +
           '\n\n' + (val('message') || '(no message)') +
           '\n\nSent from walshdigitalco.com';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      var bad = form.querySelector(':invalid');
      if (bad) bad.focus();
      say('Add your name and a valid email and it\'ll go through.', 'bad');
      return;
    }
    // a filled honeypot means a bot — accept it silently rather than tip it off
    if (val('_gotcha')) { say('Thanks — I\'ll be in touch shortly.', 'ok'); form.reset(); return; }

    if (!ENDPOINT) {
      window.location.href = 'mailto:hello@walshdigitalco.com?subject=' +
        encodeURIComponent('Enquiry from ' + (val('business') || val('name'))) +
        '&body=' + encodeURIComponent(summary());
      say('Opening your email app with the details filled in.', 'ok');
      return;
    }

    btn.disabled = true;
    say('Sending…');
    var fd = new FormData(form);
    fd.delete('_gotcha');
    fd.append('access_key', WEB3FORMS_KEY);
    fd.append('subject', 'Enquiry — ' + (val('business') || val('name')) + ' (' + val('plan') + ')');
    fd.append('from_name', 'Walsh Digital Co. website');
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: fd
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      form.reset();
      if (window.gtag) window.gtag('event', 'generate_lead', { form_name: 'contact' });
      say('Got it — I\'ll come back to you within a day.', 'ok');
    }).catch(function () {
      say('That didn\'t send. Email hello@walshdigitalco.com and I\'ll pick it up there.', 'bad');
    }).then(function () { btn.disabled = false; });
  });
  })();

  /* Analytics is Google Analytics 4, loaded from the gtag snippet in each
     page's <head> rather than from here. It sets cookies, so the privacy
     page has an Analytics and cookies section that must stay accurate if
     the property or the tag ever changes. */

  /* ── build your own (plans page only) ───────────────
     the exception path for businesses that already have
     some of the pieces. prices the selection, then shows
     honestly which of the three plans beats it — the
     ladder is steep enough that it usually does.
     ─────────────────────────────────────────────────── */
  (function () {
  var deck = document.getElementById('deckBuild');
  if (!deck) return;

  var SERVICES = [
    { key: 'social',   name: 'Social media management', price: 299 },
    { key: 'content',  name: 'Content creation',        price: 249 },
    { key: 'website',  name: 'Website',                 price: 199 },
    { key: 'seo',      name: 'SEO',                     price: 199 },
    { key: 'branding', name: 'Branding',                price: 149 }
  ];
  /* taken together these price as a pair, not as two line items */
  var PAIRS = [
    { keys: ['social', 'content'], name: 'Social + content', price: 399 },
    { keys: ['website', 'seo'],    name: 'Website + SEO',    price: 299 }
  ];
  var ALL = ['website', 'branding', 'seo', 'social', 'content'];
  var PLANS = [
    /* Foundation carries Basic SEO, not the standalone SEO service — so it must not
       be offered as covering someone who explicitly asked for SEO. */
    { name: 'Foundation', price: 199, covers: ['website', 'branding'],
      extra: 'hosting, maintenance and lead forms' },
    { name: 'Growth', price: 499, covers: ALL,
      extra: '15 videos a month, Google Business Profile and monthly reporting' },
    { name: 'Premium', price: 799, covers: ALL,
      extra: '30 videos a month, industry-specific features and priority support' }
  ];
  var LABEL = { website: 'your website', branding: 'branding', seo: 'SEO',
                social: 'social management', content: 'monthly content' };

  var picks   = {};
  var linesEl = document.getElementById('buildLines');
  var emptyEl = document.getElementById('buildEmpty');
  var nudgeEl = document.getElementById('buildNudge');
  var sendEl  = document.getElementById('buildSend');

  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function priceOf(k) {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].key === k) return SERVICES[i].price;
    return 0;
  }
  function row(l, v, cls) {
    return '<div class="row ' + (cls || '') + '"><span class="l">' + l +
           '</span><span class="v">' + v + '</span></div>';
  }
  function list(arr) {
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  SERVICES.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="tick" aria-hidden="true">&#10003;</span>' + s.name +
                  ' <span class="pr">' + money(s.price) + '/mo</span>';
    b.addEventListener('click', function () {
      picks[s.key] = !picks[s.key];
      b.classList.toggle('on', picks[s.key]);
      b.setAttribute('aria-pressed', picks[s.key] ? 'true' : 'false');
      render();
    });
    deck.appendChild(b);
  });

  /* the cheapest plan that covers everything they picked — never a dearer
     one, even where a dearer one would also fit. */
  function nudge(keys, total) {
    var fits = PLANS.filter(function (p) {
      return keys.every(function (k) { return p.covers.indexOf(k) >= 0; });
    });
    if (!fits.length) return '';
    var best = fits.reduce(function (a, b) { return b.price < a.price ? b : a; });
    var gains = best.covers.filter(function (k) { return keys.indexOf(k) < 0; })
                           .map(function (k) { return LABEL[k]; });
    var adds = gains.length ? 'It adds ' + list(gains) + ', plus ' + best.extra + '.'
                            : 'It also carries ' + best.extra + '.';
    var head, body;

    if (best.price < total) {
      head = best.name + ' is ' + money(total - best.price) + ' less';
      body = 'Everything you picked is already in it. ' + adds;
    } else if (best.price === total) {
      head = best.name + ' is the same price';
      body = adds;
    } else if (best.price - total <= 200) {
      head = 'You\'re ' + money(best.price - total) + ' from ' + best.name;
      body = adds;
    } else {
      return '';
    }

    var out = '<div class="nudge"><b>' + head + '</b><span>' + body + '</span>' +
              '<a href="mailto:hello@walshdigitalco.com?subject=' +
              encodeURIComponent(best.name + ' plan enquiry — Walsh Digital Co.') +
              '" class="ulink">Switch to ' + best.name + ' <span aria-hidden="true">↗</span></a></div>';

    /* if they have built past Premium, say so — it is still the honest cheaper option */
    if (best.name === 'Growth' && total > 799) {
      out += '<p class="nudge-2">Or Premium at ' + money(799) + '/mo — also less than your ' +
             'selection, with 30 videos a month and industry-specific features.</p>';
    }
    return out;
  }

  function render() {
    var chosen = SERVICES.filter(function (s) { return picks[s.key]; });

    if (!chosen.length) {
      linesEl.innerHTML = '';
      nudgeEl.innerHTML = '';
      emptyEl.style.display = 'block';
      sendEl.setAttribute('href', 'mailto:hello@walshdigitalco.com');
      return;
    }
    emptyEl.style.display = 'none';

    var left = chosen.slice(), lines = [], total = 0, saved = 0;
    PAIRS.forEach(function (p) {
      if (!p.keys.every(function (k) { return picks[k]; })) return;
      var full = p.keys.reduce(function (a, k) { return a + priceOf(k); }, 0);
      lines.push([p.name, money(p.price)]);
      saved += full - p.price;
      total += p.price;
      left = left.filter(function (s) { return p.keys.indexOf(s.key) < 0; });
    });
    left.forEach(function (s) { lines.push([s.name, money(s.price)]); total += s.price; });

    var h = lines.map(function (l) { return row(l[0], l[1]); }).join('');
    if (saved) h += row('Paired pricing', '−' + money(saved), 'save');
    h += row('Your package', money(total) + '/mo', 'total');
    linesEl.innerHTML = h;

    nudgeEl.innerHTML = nudge(chosen.map(function (s) { return s.key; }), total);

    var body = 'Hi Phillip, I built this package on the site:\n\n' +
               lines.map(function (l) { return '• ' + l[0] + ' — ' + l[1] + '/mo'; }).join('\n') +
               (saved ? '\n• Paired pricing — −' + money(saved) : '') +
               '\n\nTotal: ' + money(total) + '/mo\n\nSent from walshdigitalco.com';
    sendEl.setAttribute('href', 'mailto:hello@walshdigitalco.com?subject=' +
      encodeURIComponent('Custom package — Walsh Digital Co.') +
      '&body=' + encodeURIComponent(body));
  }

  render();
  })();

  /* ── self-audit (the fix page only) ─────────────────
     Seven chips, a tally, and a verdict. Nothing leaves
     the browser — no storage, no network.
     ─────────────────────────────────────────────────── */
  (function () {
  var deck = document.getElementById('auditDeck');
  if (!deck) return;

  var nEl     = document.getElementById('auditN');
  var verdict = document.getElementById('auditVerdict');
  var first   = document.getElementById('auditFirst');
  var firstTx = document.getElementById('auditFirstTxt');
  var chips   = Array.prototype.slice.call(deck.querySelectorAll('.chip'));
  var cta     = document.getElementById('auditCta');

  var LINES = [
    'Nothing ticked. Either you’ve had this handled or it’s worth a second, more sceptical look — open your own site on your phone, on cell service, and time it.',
    'One gap. You’re ahead of most of your competition already; this is worth closing but it isn’t urgent.',
    'Two gaps. Still in decent shape — both of these are a weekend of work, not a rebuild.',
    'Three. This is roughly where the average local business sits, which is exactly why the ones who fix it pull ahead.',
    'Four. Enough that people are quietly bouncing before they ever call you, and you’d have no way of knowing.',
    'Five. Most people searching for your trade right now are finding someone else, and it isn’t because they’re better at the job.',
    'Six. Your presence is actively working against you — the good news is that none of it is hard to fix.',
    'All seven. Nothing here is fatal and nothing here is expensive; it just needs doing in order, starting at the top.'
  ];

  function render() {
    var on = chips.filter(function (c) { return c.classList.contains('on'); });
    var n  = on.length;

    nEl.textContent = n;
    verdict.textContent = LINES[n];

    if (cta) {
      var nums = on.map(function (c) { return c.getAttribute('data-n'); });
      cta.setAttribute('href', 'audit.html' + (n ? '?issues=' + nums.join(',') : ''));
      cta.firstChild.textContent = n ? 'Get the full audit for these ' : 'Get a free audit ';
    }

    if (n) {
      /* chips sit in cost order, so the lowest number ticked is the place to start */
      var top = on.reduce(function (a, b) {
        return (+a.getAttribute('data-n') < +b.getAttribute('data-n')) ? a : b;
      });
      firstTx.textContent = top.getAttribute('data-fix');
      first.hidden = false;
    } else {
      first.hidden = true;
    }
  }

  deck.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    var on = chip.classList.toggle('on');
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    render();
  });

  render();
  })();
  /* ── free audit request (audit page only) ───────────
     The site's primary conversion. Two short steps —
     the business first, then where to send it — because
     a long single form is where people give up.
     Without JavaScript both steps show and the form posts
     straight to Web3Forms, which redirects back here.
     ─────────────────────────────────────────────────── */
  (function () {
  var form = document.getElementById('auditForm');
  if (!form) return;

  var done   = document.getElementById('auditDone');
  var note   = document.getElementById('auditNote');
  var sendEl = document.getElementById('auditSend');
  var steps  = [].slice.call(form.querySelectorAll('.af-step'));
  var prog   = [].slice.call(form.querySelectorAll('.af-prog li'));
  var EMAIL  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  form.classList.add('js-steps');

  function say(msg, cls) { note.textContent = msg; note.className = 'ct-note' + (cls ? ' ' + cls : ''); }
  function val(n) { var el = form.elements[n]; return el && el.value ? el.value.trim() : ''; }

  function go(n) {
    steps.forEach(function (s) { s.classList.toggle('on', +s.dataset.step === n); });
    prog.forEach(function (li) {
      var k = +li.dataset.for;
      li.classList.toggle('on', k === n);
      li.classList.toggle('done', k < n);
    });
    say('');
    var first = steps[n - 1].querySelector('input:not([type=hidden]):not(.ct-hp),select,textarea');
    if (first) first.focus({ preventScroll: true });
    var top = form.getBoundingClientRect().top;
    if (top < 70) window.scrollBy({ top: top - 90, behavior: 'smooth' });
  }

  /* the first empty or malformed required field in a step, if any */
  function problem(step) {
    var req = step.querySelectorAll('[required]');
    for (var i = 0; i < req.length; i++) {
      var el = req[i], v = el.value.trim();
      if (!v) return { el: el, msg: 'Add your ' + labelOf(el) + ' and it’ll go through.' };
      if (el.type === 'email' && !EMAIL.test(v)) return { el: el, msg: 'That email doesn’t look right — check it and try again.' };
    }
    return null;
  }
  function labelOf(el) {
    var l = el.closest('label'), s = l && l.querySelector('span');
    return s ? s.firstChild.textContent.trim().toLowerCase() : 'details';
  }

  form.querySelector('[data-next]').addEventListener('click', function () {
    var p = problem(steps[0]);
    if (p) { p.el.focus(); say(p.msg, 'bad'); return; }
    go(2);
  });
  form.querySelector('[data-back]').addEventListener('click', function () { go(1); });
  // Enter in a step-one field moves forward instead of submitting half a form
  steps[0].addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      form.querySelector('[data-next]').click();
    }
  });

  /* arriving from The Fix self-check: carry the ticked items over */
  var q = new URLSearchParams(location.search);
  if (q.get('issues')) {
    var FIX = { 1: 'Number isn’t one tap on mobile', 2: 'Not in the map pack', 3: 'Reviews are old or unanswered',
                4: 'Slow on a phone', 5: 'Photos are stock', 6: 'Nothing updated in a year', 7: 'No clear way to book or quote' };
    var picked = q.get('issues').split(',').map(function (n) { return FIX[n]; }).filter(Boolean);
    if (picked.length) form.elements.message.value = 'From The Fix self-check: ' + picked.join('; ') + '.';
  }
  if (q.get('sent')) showDone({});

  function normUrl(v) {
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, '');
  }
  function handle(v, site) {
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || v.indexOf(site) >= 0) return normUrl(v);
    return '@' + v.replace(/^@/, '');
  }
  /* base64url of UTF-8 JSON — the lead, packed for the internal audit desk */
  function pack(o) {
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(o))));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function showDone(d) {
    form.hidden = true;
    done.hidden = false;
    if (d.name) document.getElementById('auditDoneLead').textContent =
      'Thanks, ' + d.name.split(' ')[0] + '. Here’s what happens next.';
    if (d.business) document.getElementById('auditDone1').textContent =
      d.business + '’s website, Google profile and social — the way a new customer would see them.';
    if (d.email) document.getElementById('auditDone2').textContent =
      'Sent to ' + d.email + ' within two business days. Short, prioritised, plain English.';
    done.focus({ preventScroll: true });
    var top = done.getBoundingClientRect().top;
    if (top < 70 || top > window.innerHeight * 0.6) window.scrollBy({ top: top - 100, behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var p = problem(steps[0]);
    if (p) { go(1); p.el.focus(); say(p.msg, 'bad'); return; }
    p = problem(steps[1]);
    if (p) { p.el.focus(); say(p.msg, 'bad'); return; }
    if (form.elements.botcheck.checked) { showDone({}); return; }   // a bot; don't tip it off

    var struggles = [].slice.call(form.querySelectorAll('input[name=struggles]:checked'))
                      .map(function (c) { return c.value; });
    var lead = {
      business: val('business'), industry: val('industry'), website: normUrl(val('website')),
      instagram: handle(val('instagram'), 'instagram.com'), tiktok: handle(val('tiktok'), 'tiktok.com'),
      city: val('city'), name: val('name'), email: val('email'), phone: val('phone'),
      struggles: struggles, message: val('message')
    };
    var payload = {
      access_key: WEB3FORMS_KEY,
      subject: 'Free audit request — ' + lead.business + ' (' + lead.city + ')',
      from_name: 'Walsh Digital Co. website',
      email: lead.email,
      'Business': lead.business,
      'Industry': lead.industry,
      'City / market': lead.city,
      'Website': lead.website || '—',
      'Instagram': lead.instagram || '—',
      'TikTok': lead.tiktok || '—',
      'Name': lead.name,
      'Phone': lead.phone || '—',
      'Struggling with': struggles.length ? struggles.join('; ') : '—',
      'Notes': lead.message || '—',
      'Open in Audit Desk': 'https://www.walshdigitalco.com/desk.html#lead=' + pack(lead)
    };

    sendEl.disabled = true;
    say('Sending…');
    fetch(WEB3FORMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.success === false) throw new Error(j.message || r.status);
      });
    }).then(function () {
      if (window.gtag) window.gtag('event', 'generate_lead', { form_name: 'free_audit' });
      showDone(lead);
    }).catch(function () {
      /* never lose a lead to a network hiccup: offer the same details by email */
      var body = Object.keys(payload).filter(function (k) { return /^[A-Z]/.test(k) && k !== 'Open in Audit Desk'; })
        .map(function (k) { return k + ': ' + payload[k]; }).join('\n') + '\nEmail: ' + lead.email;
      var href = 'mailto:hello@walshdigitalco.com?subject=' + encodeURIComponent(payload.subject) +
                 '&body=' + encodeURIComponent(body);
      note.className = 'ct-note bad';
      note.innerHTML = 'That didn’t send. <a href="' + href + '" style="text-decoration:underline">Email it instead</a> ' +
                       '— your details are already filled in.';
      sendEl.disabled = false;
    });
  });
  })();
  /* ── section rail (homepage) ─────────────────────────
     highlights the section under the middle of the screen,
     and only shows once the film is scrolled past.
     ─────────────────────────────────────────────────── */
  (function () {
  var rail = document.getElementById('rail');
  if (!rail) return;
  var links = [].slice.call(rail.querySelectorAll('a'));
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var foot = document.querySelector('.foot');
  var tick = false;

  function update() {
    tick = false;
    var mid = window.innerHeight * 0.45, cur = -1;
    secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= mid) cur = i; });
    var first = secs[0] && secs[0].getBoundingClientRect().top;
    var footTop = foot ? foot.getBoundingClientRect().top : Infinity;
    rail.classList.toggle('on', first < window.innerHeight * 0.7 && footTop > window.innerHeight * 0.55);
    links.forEach(function (a, i) {
      if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', function () {
    if (!tick) { tick = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
  })();
})();
