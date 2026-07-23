/* Scroll-reveal + route-map draw-in. Progressive enhancement, respects
   prefers-reduced-motion (the CSS only hides content under .has-js, which is
   set in the head; if this script never runs, nothing is hidden). */
(function () {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var sel = '.section-head, .fact, .card, .area, .news-card, .stop, .map-frame, .theme-strip, .cta-band .wrap, .route-map, .post-body, .prose';
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));

    // Stagger children within a group for a cascading feel.
    Array.prototype.slice.call(document.querySelectorAll('.grid, .facts, .news-grid')).forEach(function (group) {
      Array.prototype.slice.call(group.children).forEach(function (child, i) {
        child.style.transitionDelay = (Math.min(i, 6) * 70) + 'ms';
      });
    });

    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    els.forEach(function (el) { io.observe(el); });
  } catch (err) {
    // On any failure, make sure nothing stays hidden.
    document.documentElement.classList.remove('has-js');
  }
})();
