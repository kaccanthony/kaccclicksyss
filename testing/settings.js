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
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('panel-' + btn.dataset.tab).classList.remove('hidden');
    });
});

// ── Toggle-dependent select ────────────────────────
function toggleDependent(checkbox, selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.classList.toggle('disabled', !checkbox.checked);
}

// ── Browser notification permission ───────────────
function requestBrowserPermission(checkbox) {
    if (checkbox.checked) {
        if (!('Notification' in window)) {
            alert('Your browser does not support notifications.');
            checkbox.checked = false;
            return;
        }
        Notification.requestPermission().then(p => {
            if (p !== 'granted') checkbox.checked = false;
        });
    }
}

// ── Auto-hide save toast ───────────────────────────
document.querySelectorAll('.save-toast').forEach(toast => {
    setTimeout(() => {
        toast.style.transition = 'opacity .4s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
});

async function submitProfileForm(formId, type) {
    const form = document.getElementById(formId);
    const changedLabels = "profile settings";

    openConfirm(changedLabels, () => {
        form.submit();
    });
}

// Confirm modal functions (unchanged)
function openConfirm(label, onConfirm) {
    document.getElementById('confirm-msg').textContent = 
        `Are you sure you want to update your ${label}?`;
    document.getElementById('confirm-backdrop').classList.add('open');

    const btn = document.getElementById('confirm-ok-btn');
    btn.onclick = () => {
        closeConfirm();
        onConfirm();
    };
}

function closeConfirm() {
    document.getElementById('confirm-backdrop').classList.remove('open');
}