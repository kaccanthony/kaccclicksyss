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

// ════════════════════════════════════════════════════
// PROFANITY CHECK + CONFIRM MODAL
// ════════════════════════════════════════════════════

let pendingFormId   = null;
let pendingFormType = null;

// ── Check profanity via API Ninjas ─────────────────
async function checkProfanity(text) {
    if (!text.trim()) return false;
    try {
        const res = await fetch(
            `https://api.api-ninjas.com/v1/profanityfilter?text=${encodeURIComponent(text)}`,
            { headers: { 'X-Api-Key': PROFANITY_API_KEY } }
        );
        const data = await res.json();
        return data.has_profanity === true;
    } catch (e) {
        console.warn('Profanity API error:', e);
        return false; // fail open — don't block on API error
    }
}

// ── Show profanity toast ───────────────────────────
function showProfanityToast() {
    const t = document.getElementById('profanity-toast');
    t.classList.add('show');
}
function closeProfanityToast() {
    document.getElementById('profanity-toast').classList.remove('show');
}

// ── Confirm modal ──────────────────────────────────
function openConfirm(fieldLabel, onConfirm) {
    document.getElementById('confirm-msg').textContent =
        `Are you sure you want to update your ${fieldLabel}? This will be saved to your profile.`;
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

// ── Submit profile form with checks ───────────────
async function submitProfileForm(formId, type) {
    const form   = document.getElementById(formId);
    const inputs = form.querySelectorAll('input[data-profanity-check="true"]');

    // Collect all values that changed and need profanity check
    const toCheck = [];
    inputs.forEach(input => {
        if (input.value.trim()) {
            toCheck.push({ input, label: input.dataset.confirm || 'field' });
        }
    });

    // Check all fields for profanity first
    for (const item of toCheck) {
        const hasProfanity = await checkProfanity(item.input.value);
        if (hasProfanity) {
            showProfanityToast();
            item.input.focus();
            item.input.style.borderColor = 'rgba(255,80,80,.6)';
            setTimeout(() => item.input.style.borderColor = '', 3000);
            return; // stop — don't submit
        }
    }

    // Build a label for what's being changed
    const changedLabels = toCheck.map(i => i.label).join(', ');
    const label = changedLabels || 'profile settings';

    openConfirm(label, () => {
        form.submit();
    });
}