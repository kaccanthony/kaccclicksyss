// ── Profile popup toggle (same pattern as dashboard.js) ──
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profilePopup.classList.toggle('open');
        if (chev) chev.classList.toggle('open', isOpen);
    });
    document.addEventListener('click', (e) => {
        if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('open');
            if (chev) chev.classList.remove('open');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            profilePopup.classList.remove('open');
            if (chev) chev.classList.remove('open');
        }
    });
}

// ── Scroll-triggered slide-in for staff cards, alternating left/right ──
// Re-triggers every time a card enters/leaves view (not a one-shot reveal),
// matching "every time the user scrolls down" — toggling in both directions
// keeps it feeling alive rather than firing once and going static.
(function () {
    const cards = document.querySelectorAll('.staff-card');
    cards.forEach((card, i) => {
        if (i % 2 === 1) card.classList.add('slide-right');
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            entry.target.classList.toggle('in-view', entry.isIntersecting);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    cards.forEach(card => observer.observe(card));
})();