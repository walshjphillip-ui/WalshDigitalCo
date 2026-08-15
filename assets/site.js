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

  /* ── package builder (pricing page only) ──────────── */
  var deckOnce = document.getElementById('deckOnce');
  if (!deckOnce) return;

  var BUNDLE_PCT = 10;
  var ONCE = [
    { key: 'website', name: 'Website',             price: 2400 },
    { key: 'brand',   name: 'Brand identity',      price: 1200 },
    { key: 'film',    name: 'Video & photography', price: 1600 }
  ];
  var MONTHLY = [
    { key: 'social', name: 'Social & content',         price: 600 },
    { key: 'seo',    name: 'Google profile & local SEO', price: 350 }
  ];
  var picks = { website: true, brand: false, film: false, social: true, seo: false };

  var deckMon = document.getElementById('deckMonthly');
  var linesEl = document.getElementById('estLines');
  var emptyEl = document.getElementById('estEmpty');
  var sendEl  = document.getElementById('estSend');

  function money(n) { return '$' + n.toLocaleString('en-US'); }

  function makeChip(s, suffix) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (picks[s.key] ? ' on' : '');
    b.setAttribute('aria-pressed', picks[s.key] ? 'true' : 'false');
    b.innerHTML = '<span class="tick" aria-hidden="true">&#10003;</span>' + s.name +
                  ' <span class="pr">' + money(s.price) + suffix + '</span>';
    b.addEventListener('click', function () {
      picks[s.key] = !picks[s.key];
      b.classList.toggle('on', picks[s.key]);
      b.setAttribute('aria-pressed', picks[s.key] ? 'true' : 'false');
      render();
    });
    return b;
  }

  ONCE.forEach(function (s) { deckOnce.appendChild(makeChip(s, '')); });
  MONTHLY.forEach(function (s) { deckMon.appendChild(makeChip(s, '/mo')); });

  function row(label, value, cls) {
    return '<div class="row ' + (cls || '') + '"><span class="l">' + label +
           '</span><span class="v">' + value + '</span></div>';
  }

  function render() {
    var onceSel = ONCE.filter(function (s) { return picks[s.key]; });
    var monSel  = MONTHLY.filter(function (s) { return picks[s.key]; });
    var onceSum = onceSel.reduce(function (a, s) { return a + s.price; }, 0);
    var monSum  = monSel.reduce(function (a, s) { return a + s.price; }, 0);
    var disc    = onceSel.length >= 2 ? Math.round(onceSum * BUNDLE_PCT / 100) : 0;

    if (!onceSel.length && !monSel.length) {
      linesEl.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      var h = '';
      if (onceSel.length) {
        h += row('One-time subtotal', money(onceSum));
        if (disc) h += row('Bundle saving (' + BUNDLE_PCT + '%)', '−' + money(disc), 'save');
        h += row('Project total', money(onceSum - disc), 'total');
      }
      if (monSum) {
        h += row(onceSel.length ? 'Then monthly' : 'Monthly', money(monSum) + '/mo',
                 onceSel.length ? '' : 'total');
      }
      linesEl.innerHTML = h;
    }

    var list = onceSel.map(function (s) { return s.name + ' (' + money(s.price) + ')'; })
      .concat(monSel.map(function (s) { return s.name + ' (' + money(s.price) + '/mo)'; }));
    var body = 'Hi Phillip, these are the services I am interested in:\n\n' +
               list.map(function (p) { return '• ' + p; }).join('\n') +
               '\n\nSent from walshdigitalco.com';
    sendEl.setAttribute('href', 'mailto:hello@walshdigitalco.com?subject=' +
      encodeURIComponent('Project enquiry — Walsh Digital Co.') +
      '&body=' + encodeURIComponent(body));
  }

  render();
})();
