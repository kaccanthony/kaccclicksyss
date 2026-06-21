// ── Profile popup toggle ──────────────────────────────
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = profilePopup.classList.toggle('open');
    chev.classList.toggle('open', isOpen);
});

// Close when clicking outside
document.addEventListener('click', (e) => {
    if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});