// ── Lagging background glow blob ─────────────────────
const blob = document.getElementById('bg-glow');

let mouseX = window.innerWidth  / 2;
let mouseY = window.innerHeight / 2;
let blobX  = mouseX;
let blobY  = mouseY;

const LERP = 0.07; // lower = more lag (0.04 dreamy · 0.07 default · 0.15 snappy)

document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function animateBlob() {
    blobX += (mouseX - blobX) * LERP;
    blobY += (mouseY - blobY) * LERP;
    blob.style.left = blobX + 'px';
    blob.style.top  = blobY + 'px';
    requestAnimationFrame(animateBlob);
}

animateBlob();

// ── Password show / hide toggle (works for any number of fields) ──
document.querySelectorAll('.pw-toggle').forEach(btn => {
    const field = document.getElementById(btn.dataset.target);
    if (!field) return;
    btn.addEventListener('click', () => {
        const isHidden = field.type === 'password';
        field.type = isHidden ? 'text' : 'password';
        const icon = btn.querySelector('i');
        icon.classList.toggle('fa-eye', !isHidden);
        icon.classList.toggle('fa-eye-slash', isHidden);
    });
});

// ── Forgot password modal ─────────────────────────────
const backdrop  = document.getElementById('modal-backdrop');
const forgotBtn = document.getElementById('forgot-btn');
const closeBtn  = document.getElementById('modal-close');

forgotBtn.addEventListener('click', () => backdrop.classList.add('open'));
closeBtn.addEventListener('click',  () => backdrop.classList.remove('open'));
backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('open');
});

