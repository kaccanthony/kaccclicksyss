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

// ── Profile Form Submit ─────────────────────────────
function submitProfileForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    _confirmCallback = () => form.submit();

    document.getElementById('confirm-backdrop').classList.add('open');
    document.getElementById('confirm-ok-btn').onclick = () => {
        document.getElementById('confirm-backdrop').classList.remove('open');
        form.submit();
    };
}

/* ── Confirm modal helpers ── */
let _confirmCallback = null;

function openConfirm(cb) {
    _confirmCallback = cb;
    document.getElementById('confirm-backdrop').classList.add('open');
    document.getElementById('confirm-ok').onclick = () => {
        closeConfirm();
        if (_confirmCallback) _confirmCallback();
    };
}

function closeConfirm() {
    document.getElementById('confirm-backdrop').classList.remove('open');
}

// Close confirm on backdrop click
document.getElementById('confirm-backdrop').addEventListener('click', function(e) {
    if (e.target === this) closeConfirm();
});


/* ══════════════════════════════════════════════════════
   AVATAR UPLOAD
══════════════════════════════════════════════════════ */
document.getElementById('avatar-file-input')?.addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
        showUploadErrorToast(`Your photo is ${(file.size/1024/1024).toFixed(1)} MiB. Maximum allowed is 5 MiB.`);
        this.value = '';
        return;
    }

    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.type)) {
        showUploadErrorToast('Only JPEG, PNG, GIF, or WebP images are allowed.');
        this.value = '';
        return;
    }

    // Show spinner overlay
    const ring = document.getElementById('avatar-upload-ring');
    if (ring) ring.classList.add('active');

    const fd = new FormData();
    fd.append('avatar', file);

    try {
        const res  = await fetch('upload_avatar.php', { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            // Preview new avatar immediately
            const preview = document.getElementById('avatar-preview');
            const placeholder = document.getElementById('avatar-placeholder');
            const reader = new FileReader();
            reader.onload = e => {
                if (preview) {
                    preview.src = e.target.result;
                } else {
                    const img = document.createElement('img');
                    img.id = 'avatar-preview';
                    img.src = e.target.result;
                    img.alt = 'Avatar';
                    img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
                    const wrap = document.getElementById('avatar-preview-wrap');
                    if (placeholder) placeholder.remove();
                    wrap.appendChild(img);
                }
            };
            reader.readAsDataURL(file);

            showAvatarSuccessToast();
        } else {
            showUploadErrorToast(data.error || 'Upload failed');
        }
    } catch (err) {
        showUploadErrorToast('Network error — please try again');
    } finally {
        if (ring) ring.classList.remove('active');
        this.value = ''; // reset input
    }
});

function showAvatarSuccessToast() {
    const t = document.createElement('div');
    t.style.cssText = `
        position:fixed;bottom:24px;right:24px;
        background:#1e1e2e;border:1px solid rgba(80,200,120,.4);
        border-radius:12px;padding:12px 16px;
        display:flex;align-items:center;gap:10px;
        color:#e0e0f0;font-size:13px;
        box-shadow:0 12px 36px rgba(0,0,0,.45);
        z-index:2000;animation:toastIn .25s ease;`;
    t.innerHTML = `<i class="fas fa-circle-check" style="color:#4ade80;font-size:16px;"></i> Photo updated successfully`;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'toastOut .25s ease forwards';
        setTimeout(() => t.remove(), 260);
    }, 3000);
}

function showUploadErrorToast(msg) {
    const t = document.createElement('div');
    t.className = 'error-toast';
    t.innerHTML = `
        <div class="error-toast-icon"><i class="fas fa-triangle-exclamation"></i></div>
        <div class="error-toast-body">
            <div class="error-toast-title">Upload failed</div>
            <div class="error-toast-msg">${msg}</div>
        </div>
        <button class="error-toast-close" onclick="this.parentElement.remove()"><i class="fas fa-xmark"></i></button>`;
    document.body.appendChild(t);
}

/* ══════════════════════════════════════════════════════
   CHANGE PASSWORD MODAL
══════════════════════════════════════════════════════ */
function openPwModal() {
    document.getElementById('pw-modal-backdrop').classList.add('open');
    ['pw-old','pw-new','pw-re'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    hidePwError();
    document.getElementById('forgot-popup').style.display = 'none';
    setTimeout(() => document.getElementById('pw-old')?.focus(), 100);
}

function closePwModal() {
    document.getElementById('pw-modal-backdrop').classList.remove('open');
    hidePwError();
    document.getElementById('pw-submit-btn').classList.remove('loading');
    document.getElementById('pw-submit-btn').disabled = false;
}

function closePwModalOnBackdrop(e) {
    if (e.target === document.getElementById('pw-modal-backdrop')) closePwModal();
}

function togglePwVis(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('i').className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function showPwError(msg) {
    const el = document.getElementById('pw-error');
    document.getElementById('pw-error-msg').textContent = msg;
    el.classList.add('show');
}

function hidePwError() {
    document.getElementById('pw-error').classList.remove('show');
}

function toggleForgotPopup(e) {
    e.stopPropagation();
    const p = document.getElementById('forgot-popup');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

// Close forgot popup on outside click
document.addEventListener('click', () => {
    const p = document.getElementById('forgot-popup');
    if (p) p.style.display = 'none';
});

async function submitPasswordChange() {
    hidePwError();
    const old = document.getElementById('pw-old').value;
    const nw  = document.getElementById('pw-new').value;
    const re  = document.getElementById('pw-re').value;

    if (!old || !nw || !re) {
        showPwError('All fields are required.');
        return;
    }
    if (nw !== re) {
        showPwError('New passwords do not match.');
        return;
    }
    if (nw.length < 8) {
        showPwError('New password must be at least 8 characters.');
        return;
    }

    const btn = document.getElementById('pw-submit-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res  = await fetch('change_password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: old, new_password: nw, re_password: re })
        });
        const data = await res.json();

        if (data.ok) {
            closePwModal();
            const t = document.createElement('div');
            t.style.cssText = `
                position:fixed;bottom:24px;right:24px;
                background:#1e1e2e;border:1px solid rgba(80,200,120,.4);
                border-radius:12px;padding:12px 16px;
                display:flex;align-items:center;gap:10px;
                color:#e0e0f0;font-size:13px;
                box-shadow:0 12px 36px rgba(0,0,0,.45);
                z-index:2000;animation:toastIn .25s ease;`;
            t.innerHTML = `<i class="fas fa-circle-check" style="color:#4ade80;font-size:16px;"></i> Password changed successfully`;
            document.body.appendChild(t);
            setTimeout(() => {
                t.style.animation = 'toastOut .25s ease forwards';
                setTimeout(() => t.remove(), 260);
            }, 3500);
        } else {
            showPwError(data.error || 'Something went wrong. Please try again.');
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    } catch {
        showPwError('Network error — please try again.');
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Allow Enter key to submit password modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('pw-modal-backdrop').classList.contains('open')) {
        e.preventDefault();
        submitPasswordChange();
    }
    if (e.key === 'Escape') {
        closePwModal();
        closeConfirm();
    }
});