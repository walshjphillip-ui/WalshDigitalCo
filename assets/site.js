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

  /* ── before / after: YOUR scroll wipes the redesign across ──
     --p (0–100%) lands on the section so the after layer's
     clip-path, the seam and the progress track all read it. */
  var baSec = document.getElementById('baSec');
  if (baSec) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var bTick = false;
    function baFrame() {
      if (window.innerWidth <= 920 || reduce) {   // stacked, no wipe
        baSec.style.removeProperty('--p');
        baSec.classList.remove('is-after');
        bTick = false;
        return;
      }
      var rect = baSec.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var prog = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      var t = Math.min(1, Math.max(0, (prog - 0.15) / 0.70));   // hold fully-before, then fully-after
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      baSec.style.setProperty('--p', (e * 100).toFixed(2) + '%');
      baSec.classList.toggle('is-after', e > 0.5);
      bTick = false;
    }
    window.addEventListener('scroll', function () {
      if (!bTick) { bTick = true; requestAnimationFrame(baFrame); }
    }, { passive: true });
    window.addEventListener('resize', baFrame);
    baFrame();
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
    { key: 'social', name: 'Social management',        price: 600 },
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
