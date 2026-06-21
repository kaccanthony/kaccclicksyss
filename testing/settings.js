// ── Profile popup ──────────────────────────────────
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

profileBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = profilePopup.classList.toggle('open');
    chev.classList.toggle('open', open);
});
document.addEventListener('click', e => {
    if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});

// ── Tab switcher ───────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.tab;
        document.querySelectorAll('.notif-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('panel-' + target).classList.remove('hidden');
    });
});

// ── Toggle-dependent select disable ───────────────
function toggleDependent(checkbox, selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    if (checkbox.checked) {
        sel.classList.remove('disabled');
    } else {
        sel.classList.add('disabled');
    }
}

// ── Browser notification permission ───────────────
function requestBrowserPermission(checkbox) {
    if (checkbox.checked) {
        if (!('Notification' in window)) {
            alert('Your browser does not support notifications.');
            checkbox.checked = false;
            return;
        }
        Notification.requestPermission().then(permission => {
            if (permission !== 'granted') {
                checkbox.checked = false;
            }
        });
    }
}

// ── Auto-hide save toast ───────────────────────────
const toast = document.querySelector('.save-toast');
if (toast) {
    setTimeout(() => {
        toast.style.transition = 'opacity .4s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}