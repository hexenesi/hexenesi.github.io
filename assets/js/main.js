(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Theme: cycles system -> light -> dark */
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var KEY = 'theme';
    var order = ['system', 'light', 'dark'];

    function stored() {
      try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function apply(theme) {
      if (theme === 'light' || theme === 'dark') {
        root.setAttribute('data-theme', theme);
      } else {
        root.removeAttribute('data-theme');
        theme = 'system';
      }
      btn.setAttribute('data-theme-choice', theme);
      btn.setAttribute('aria-label', 'Color theme: ' + theme + ' (click to change)');
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    }

    apply(stored() || 'system');

    btn.addEventListener('click', function () {
      var next = order[(order.indexOf(stored() || 'system') + 1) % order.length];
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if ((stored() || 'system') === 'system') {
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'system' } }));
      }
    });
  })();

  /* Mobile navigation */
  (function () {
    var toggle = document.getElementById('nav-toggle');
    var links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    function setOpen(open) {
      links.classList.toggle('is-open', open);
      toggle.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!links.classList.contains('is-open'));
    });

    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  })();

  /* Reveal on scroll */
  (function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var targets = document.querySelectorAll('[data-reveal]');
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  })();
})();
