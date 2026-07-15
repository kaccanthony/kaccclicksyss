// ── Profile Popup Toggle ──────────────────────────────
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

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ── Time helpers ──────────────────────────────────────
// PHP already computed the correct BST/GMT offset for this exact date (DST-aware),
// so we can tell which label applies just by checking the offset baked into the ISO string.
function bstOrGmtLabel(iso) {
    return iso && iso.includes('+01:00') ? 'BST' : 'GMT';
}

function formatSessionTimes(iso) {
    if (!iso) return { bst: '—', local: '', relative: '' };
    const d = new Date(iso);
    const label = bstOrGmtLabel(iso);
    const bstStr = d.toLocaleString('en-GB', {
        timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }) + ' ' + label;
    const localStr = d.toLocaleString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    return { bst: bstStr, local: localStr, relative: formatRelative(d) };
}

function formatRelative(d) {
    const diffMs = d - new Date();
    if (diffMs <= 60000) return { text: 'Starting now', soon: true };
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return { text: `in ${mins} minute${mins === 1 ? '' : 's'}`, soon: mins <= 15 };
    const hours = Math.round(mins / 60);
    if (hours < 24) return { text: `in ${hours} hour${hours === 1 ? '' : 's'}`, soon: hours <= 1 };
    const days = Math.round(hours / 24);
    return { text: `in ${days} day${days === 1 ? '' : 's'}`, soon: false };
}

// ── Shared pill-row builder (used by every view so the info set stays consistent) ──
function buildPillRow(s) {
    const parts = [];
    parts.push(`<span class="sesh-pill pill-host"><i class="fas fa-user-tie"></i> Host: ${escapeHtml(s.host || '—')}</span>`);
    parts.push(`<span class="sesh-pill ${s.cohost_filled >= s.cohost_total ? 'pill-fraction-full' : ''}"><i class="fas fa-user-friends"></i> Co-Hosts ${s.cohost_filled}/${s.cohost_total}</span>`);
    if (s.supervisor_name) {
        parts.push(`<span class="sesh-pill pill-supervisor"><i class="fas fa-user-shield"></i> Supervisor: ${escapeHtml(s.supervisor_name)}</span>`);
    }
    parts.push(`<span class="sesh-pill ${s.assistant_filled >= s.assistant_total ? 'pill-fraction-full' : ''}"><i class="fas fa-users"></i> Assistants ${s.assistant_filled}/${s.assistant_total}</span>`);
    parts.push(`<span class="sesh-pill ${s.trainee_filled >= s.trainee_total && s.trainee_total > 0 ? 'pill-fraction-full' : ''}"><i class="fas fa-graduation-cap"></i> Trainees ${s.trainee_filled}/${s.trainee_total}</span>`);
    if (s.trainee_timer) {
        parts.push(`<span class="sesh-pill pill-signal"><i class="fas fa-stopwatch"></i> ${escapeHtml(String(s.trainee_timer))} min/turn</span>`);
    }
    return parts.join('');
}

function buildRelativeBadge(rel) {
    return `<span class="relative-badge ${rel.soon ? 'soon' : ''}"><i class="fas fa-clock"></i> ${rel.text}</span>`;
}

function buildDetailBtn(id) {
    return `<button type="button" class="view-details-btn" onclick="openDetailModal(${parseInt(id, 10)})" title="View full details"><i class="fas fa-circle-info"></i> Details</button>`;
}

// ── Session Detail Popup (Discord name only — no Roblox name / Discord ID / notes) ──
const STAFF_CHIP_FIELDS = [
    ['host', 'fa-crown', 'Host'],
    ['co_host1', 'fa-user-tie', 'Co-Host'],
    ['co_host2', 'fa-user-tie', 'Co-Host'],
    ['co_host3', 'fa-user-tie', 'Co-Host'],
    ['co_host4/supervisor', 'fa-user-gear', 'Supervisor'],
    ['assistant_1', 'fa-user', 'Asst'],
    ['assistant_2', 'fa-user', 'Asst'],
    ['assistant_3', 'fa-user', 'Asst'],
    ['assistant_4', 'fa-user', 'Asst'],
];

function buildDetailModalHtml(s) {
    const t = formatSessionTimes(s.session_datetime_iso);
    const startOnly = s.session_datetime_iso
        ? new Date(s.session_datetime_iso).toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
        : '—';

    const staffChips = STAFF_CHIP_FIELDS
        .filter(([field]) => s[field])
        .map(([field, icon, label]) => `<span class="staff-chip"><i class="fas ${icon}"></i> ${escapeHtml(s[field])}<span class="staff-chip-role">${label}</span></span>`)
        .join('') || '<span class="no-staff-msg">No staff assigned yet</span>';

    const trainees = s.trainees || [];
    const traineeChips = trainees.map(tr => `
        <div class="trainee-chip">
            <div class="trainee-chip-avatar"><i class="fas fa-graduation-cap"></i></div>
            <div class="trainee-chip-info">
                <div class="trainee-chip-name">${escapeHtml(tr.discord || '—')}</div>
                ${tr.zone ? `<div class="trainee-chip-zone">Zone ${escapeHtml(String(tr.zone))}</div>` : ''}
                ${tr.trainer ? `<div class="trainee-chip-zone">Trainer: ${escapeHtml(tr.trainer)}</div>` : ''}
            </div>
        </div>`).join('');

    return `
        <div class="detail-header">
            <div class="detail-status detail-status--upcoming">${escapeHtml(s.session_status || 'Upcoming')}</div>
            <h2 class="detail-name">${escapeHtml(s.session_name || 'Unnamed Session')}</h2>
            <div class="detail-time-row">
                <span><i class="fas fa-clock"></i> ${t.bst}</span>
                <span><i class="fas fa-hourglass-half"></i> ${escapeHtml(String(s.session_duration))} min</span>
                <span><i class="fas fa-id-badge"></i> #${parseInt(s.session_id, 10)}</span>
            </div>
        </div>
        <div class="detail-stats">
            <div class="dstat"><div class="dstat-val">${s.trainee_filled}/${s.trainee_total}</div><div class="dstat-label">Trainees</div></div>
            <div class="dstat"><div class="dstat-val">${escapeHtml(String(s.session_duration))}m</div><div class="dstat-label">Duration</div></div>
            <div class="dstat"><div class="dstat-val">${startOnly}</div><div class="dstat-label">Start (BST)</div></div>
        </div>
        ${s.session_desc ? `<div class="detail-desc">${escapeHtml(s.session_desc).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="detail-section">
            <div class="detail-section-label">Host & Staff</div>
            <div class="detail-staff-chips">${staffChips}</div>
        </div>
        ${trainees.length ? `
        <div class="detail-section">
            <div class="detail-section-label">Trainees (${trainees.length})</div>
            <div class="chips">${traineeChips}</div>
        </div>` : ''}
    `;
}

function openDetailModal(sessionId) {
    const s = SESSIONS_DATA.find(x => x.session_id === sessionId);
    if (!s) return;
    document.getElementById('detail-modal-body').innerHTML = buildDetailModalHtml(s);
    const backdrop = document.getElementById('detail-modal-backdrop');
    backdrop.classList.remove('closing');
    backdrop.classList.add('active');
    backdrop.style.display = 'flex';
}

function closeDetailModal() {
    const backdrop = document.getElementById('detail-modal-backdrop');
    if (!backdrop.classList.contains('active')) return;
    backdrop.classList.remove('active');
    backdrop.classList.add('closing');
    setTimeout(() => { backdrop.classList.remove('closing'); backdrop.style.display = 'none'; }, 250);
}

document.getElementById('detail-modal-close')?.addEventListener('click', closeDetailModal);
document.getElementById('detail-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('detail-modal-backdrop')) closeDetailModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetailModal(); });

// ── View root + switcher ──────────────────────────────
const viewRoot = document.getElementById('view-root');
let currentView = 'grid';

const RENDERERS = { grid: renderGrid, focus: renderFocus, list: renderList, card: renderCard };

document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        RENDERERS[currentView](); // pure client-side re-render — no fetch, no reload
    });
});

function emptyState() {
    return `<div class="empty-state"><i class="fas fa-calendar-xmark"></i><div class="empty-title">No upcoming sessions</div><p>Everything scheduled from now onward will show up here.</p></div>`;
}

// ── GRID VIEW ──────────────────────────────────────────
function renderGrid() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    viewRoot.innerHTML = `<div class="grid-view">${SESSIONS_DATA.map(sessionTileHtml).join('')}</div>`;
}

function sessionTileHtml(s) {
    const t = formatSessionTimes(s.session_datetime_iso);
    return `
    <div class="sesh-tile">
        <div class="sesh-tile-top">${buildRelativeBadge(t.relative)}${buildDetailBtn(s.session_id)}</div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        <div class="sesh-time-line">
            <span class="bst-time">${t.bst}</span>
            <span>·</span>
            <span>${t.local} your time</span>
            <span>·</span>
            <span>${escapeHtml(String(s.session_duration))} min</span>
        </div>
        <div class="pill-row">${buildPillRow(s)}</div>
    </div>`;
}

// ── CARD VIEW ──────────────────────────────────────────
function renderCard() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    viewRoot.innerHTML = `<div class="card-view">${SESSIONS_DATA.map(sessionFullCardHtml).join('')}</div>`;
}

function sessionFullCardHtml(s) {
    const t = formatSessionTimes(s.session_datetime_iso);
    return `
    <div class="sesh-fullcard">
        <div class="sesh-tile-top">${buildRelativeBadge(t.relative)}${buildDetailBtn(s.session_id)}</div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        <div class="sesh-time-line">
            <span class="bst-time">${t.bst}</span>
            <span>·</span>
            <span>${t.local} your time</span>
            <span>·</span>
            <span>${escapeHtml(String(s.session_duration))} min duration</span>
        </div>
        <div class="pill-row">${buildPillRow(s)}</div>
    </div>`;
}

// ── LIST VIEW ──────────────────────────────────────────
function renderList() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    viewRoot.innerHTML = `<div class="list-view">${SESSIONS_DATA.map(sessionRowHtml).join('')}</div>`;
}

function sessionRowHtml(s) {
    const t = formatSessionTimes(s.session_datetime_iso);
    return `
    <div class="sesh-row">
        <div class="sesh-row-time"><span class="bst-time">${t.bst}</span>${t.local} your time</div>
        <div class="sesh-row-title"><div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div></div>
        <div class="sesh-row-pills">${buildPillRow(s)}</div>
        <div class="sesh-row-relative">${buildRelativeBadge(t.relative)}${buildDetailBtn(s.session_id)}</div>
    </div>`;
}

// ── FOCUS VIEW (master list + detail, same pattern as Setup Session) ──
let focusSelectedId = null;

function renderFocus() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    if (focusSelectedId === null) focusSelectedId = SESSIONS_DATA[0].session_id;

    viewRoot.innerHTML = `
    <div class="focus-layout">
        <div class="focus-list" id="focus-list">
            ${SESSIONS_DATA.map(focusListItemHtml).join('')}
        </div>
        <div class="focus-detail-panel" id="focus-detail"></div>
    </div>`;

    document.querySelectorAll('.focus-card').forEach(card => {
        card.addEventListener('click', () => {
            focusSelectedId = parseInt(card.dataset.id, 10);
            document.querySelectorAll('.focus-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            renderFocusDetail();
        });
    });

    renderFocusDetail();
}

function focusListItemHtml(s) {
    const t = formatSessionTimes(s.session_datetime_iso);
    const active = s.session_id === focusSelectedId ? 'active' : '';
    return `
    <div class="focus-card ${active}" data-id="${s.session_id}">
        <div class="sesh-time-line"><span class="bst-time">${t.bst}</span></div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        ${buildRelativeBadge(t.relative)}
    </div>`;
}

function renderFocusDetail() {
    const detailEl = document.getElementById('focus-detail');
    if (!detailEl) return;
    const s = SESSIONS_DATA.find(x => x.session_id === focusSelectedId);
    if (!s) { detailEl.innerHTML = `<div class="focus-detail-empty"><i class="fas fa-hand-pointer"></i><p>Select a session on the left to view its details.</p></div>`; return; }

    const t = formatSessionTimes(s.session_datetime_iso);
    detailEl.innerHTML = `
        <div class="focus-detail-top">${buildRelativeBadge(t.relative)}${buildDetailBtn(s.session_id)}</div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        <div class="sesh-time-line">
            <span class="bst-time">${t.bst}</span>
            <span>·</span>
            <span>${t.local} your time</span>
            <span>·</span>
            <span>${escapeHtml(String(s.session_duration))} min duration</span>
        </div>
        <div class="pill-row">${buildPillRow(s)}</div>
    `;
}

// ── Init ───────────────────────────────────────────────
renderGrid();

// Relative-time text drifts as real time passes ("in 45 minutes" → "in 44 minutes"), so
// re-render the current view's timestamps periodically without touching scroll/selection.
setInterval(() => { RENDERERS[currentView](); }, 60000);