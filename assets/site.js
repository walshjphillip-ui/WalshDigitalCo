/* Walsh Digital Co. — shared behaviour */
(function () {
  'use strict';

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
    var revealed = false, fTick = false, vidReady = false;

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

      if (vidReady && vid.duration) {                    // scrub, never play
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

    if (vid) {
      vid.addEventListener('loadedmetadata', function () { vidReady = true; filmFrame(); });
      if (vid.readyState >= 1) { vidReady = true; }
    }
    /* "Watch the transformation" — drive the scroll to the reveal beat.
       Any real input from the visitor cancels it, so they never feel trapped. */
    var playBtn = document.getElementById('filmPlay');
    if (playBtn) {
      var auto = null;
      function stopAuto() { auto = null; }
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
        window.addEventListener(ev, function (e) {
          if (auto && !(e.target && e.target.closest && e.target.closest('.film-play'))) stopAuto();
        }, { passive: true });
      });
      playBtn.addEventListener('click', function () {
        var top = film.getBoundingClientRect().top + window.pageYOffset;
        var span = film.offsetHeight - window.innerHeight;
        var from = window.pageYOffset;
        var to = top + span * 0.76;            // lands where the reveal is offered
        if (to <= from) return;
        // slow enough to actually watch the film play, not just jump to the end
        var dur = Math.min(19000, Math.max(9500, (to - from) * 8));
        var t0 = null;
        auto = {};
        var mine = auto;
        requestAnimationFrame(function step(ts) {
          if (auto !== mine) return;           // cancelled by the visitor
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur);
          var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          window.scrollTo(0, from + (to - from) * e);
          if (k < 1) requestAnimationFrame(step); else stopAuto();
        });
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
      sendEl.setAttribute('href', 'mailto:hello@walshdigitalco.com');
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

    var body = 'Hi Phillip,\n\n' +
               'Business type: ' + t.name + '\n' +
               'Looking for: ' + l.name + '\n' +
               'Suggested plan: ' + l.plan + ' (' + money(l.price) + '/mo)\n\n' +
               'Sent from walshdigitalco.com';
    sendEl.setAttribute('href', 'mailto:hello@walshdigitalco.com?subject=' +
      encodeURIComponent(l.plan + ' plan enquiry — Walsh Digital Co.') +
      '&body=' + encodeURIComponent(body));
  }

  render();
  })();

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
})();
