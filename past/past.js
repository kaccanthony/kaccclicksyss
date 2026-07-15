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

// ── Time helpers (past-oriented: "X ago" instead of "in X") ──────
function formatSessionDate(dateStr) {
    if (!dateStr) return { display: '—', relative: '' };
    const d = new Date(dateStr + 'T00:00:00');
    const display = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return { display, relative: formatAgo(d) };
}

function formatAgo(d) {
    const diffMs = new Date() - d;
    if (diffMs < 0) return 'Recently';
    const days = Math.floor(diffMs / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
}

function statusPillClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'concluded') return 'st-concluded';
    if (s === 'cancelled') return 'st-cancelled';
    return 'st-other';
}

// ── Shared builders ────────────────────────────────────
function buildPillRow(s) {
    const parts = [];
    parts.push(`<span class="sesh-pill pill-id"><i class="fas fa-hashtag"></i> Session ${s.session_id}</span>`);
    parts.push(`<span class="sesh-pill pill-host"><i class="fas fa-user-tie"></i> Host: ${escapeHtml(s.host || '—')}</span>`);
    parts.push(`<span class="sesh-pill ${s.cohost_filled >= s.cohost_total ? 'pill-fraction-full' : ''}"><i class="fas fa-user-group"></i> Co-Hosts ${s.cohost_filled}/${s.cohost_total}</span>`);
    if (s.supervisor_name) {
        parts.push(`<span class="sesh-pill pill-supervisor"><i class="fas fa-user-shield"></i> Supervisor: ${escapeHtml(s.supervisor_name)}</span>`);
    }
    parts.push(`<span class="sesh-pill ${s.assistant_filled >= s.assistant_total ? 'pill-fraction-full' : ''}"><i class="fas fa-people-group"></i> Assistants ${s.assistant_filled}/${s.assistant_total}</span>`);
    parts.push(`<span class="sesh-pill"><i class="fas fa-graduation-cap"></i> ${s.trainees_trained.length} trainee${s.trainees_trained.length === 1 ? '' : 's'} trained</span>`);
    return parts.join('');
}

function buildStatusBadge(s) {
    return `<span class="status-badge-pill ${statusPillClass(s.session_status)}"><i class="fas fa-flag"></i> ${escapeHtml(s.session_status || 'Unknown')}</span>`;
}

function buildTraineeListBlock(s) {
    if (!s.trainees_trained.length) {
        return `<div class="trainee-list-block"><div class="trainee-list-label">Trainees Trained</div><div class="no-trainees-msg">No trainees were marked as attended for this session.</div></div>`;
    }
    const chips = s.trainees_trained.map(t => `
        <span class="trainee-chip-sm">
            ${escapeHtml(t.name || 'Unnamed')}
            ${t.zone ? `<span class="zone-tag">· Zone ${escapeHtml(String(t.zone))}</span>` : ''}
            <span class="trainer-tag">· trained by ${escapeHtml(t.trainer || '—')}</span>
        </span>`).join('');
    return `<div class="trainee-list-block"><div class="trainee-list-label">Trainees Trained (${s.trainees_trained.length})</div><div class="trainee-chip-row">${chips}</div></div>`;
}

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
    return `<div class="empty-state"><i class="fas fa-box-archive"></i><div class="empty-title">No past sessions yet</div><p>Concluded and cancelled sessions will show up here once they're archived.</p></div>`;
}

// ── GRID VIEW ──────────────────────────────────────────
function renderGrid() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    viewRoot.innerHTML = `<div class="grid-view">${SESSIONS_DATA.map(sessionTileHtml).join('')}</div>`;
}

function sessionTileHtml(s) {
    const d = formatSessionDate(s.session_date);
    return `
    <div class="sesh-tile">
        <div class="sesh-tile-top">${buildStatusBadge(s)}<span class="relative-badge">${d.relative}</span></div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        ${s.session_desc ? `<div class="sesh-desc">${escapeHtml(s.session_desc)}</div>` : ''}
        <div class="sesh-time-line"><span class="bst-time">${d.display}</span></div>
        <div class="pill-row">${buildPillRow(s)}</div>
        ${buildTraineeListBlock(s)}
    </div>`;
}

// ── CARD VIEW ──────────────────────────────────────────
function renderCard() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    viewRoot.innerHTML = `<div class="card-view">${SESSIONS_DATA.map(sessionFullCardHtml).join('')}</div>`;
}

function sessionFullCardHtml(s) {
    const d = formatSessionDate(s.session_date);
    return `
    <div class="sesh-fullcard">
        <div class="sesh-tile-top">${buildStatusBadge(s)}<span class="relative-badge">${d.relative}</span></div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        ${s.session_desc ? `<div class="sesh-desc">${escapeHtml(s.session_desc)}</div>` : ''}
        <div class="sesh-time-line"><span class="bst-time">${d.display}</span></div>
        <div class="pill-row">${buildPillRow(s)}</div>
        ${buildTraineeListBlock(s)}
    </div>`;
}

// ── LIST VIEW ──────────────────────────────────────────
function renderList() {
    if (!SESSIONS_DATA.length) { viewRoot.innerHTML = emptyState(); return; }
    viewRoot.innerHTML = `<div class="list-view">${SESSIONS_DATA.map(sessionRowHtml).join('')}</div>`;
}

function sessionRowHtml(s) {
    const d = formatSessionDate(s.session_date);
    return `
    <div class="sesh-row">
        <div class="sesh-row-time"><span class="bst-time">${d.display}</span>${d.relative}</div>
        <div class="sesh-row-title">
            <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
            ${s.session_desc ? `<div class="sesh-desc">${escapeHtml(s.session_desc)}</div>` : ''}
            ${buildTraineeListBlock(s)}
        </div>
        <div class="sesh-row-pills">${buildPillRow(s)}</div>
        <div class="sesh-row-relative">${buildStatusBadge(s)}</div>
    </div>`;
}

// ── FOCUS VIEW ─────────────────────────────────────────
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
    const d = formatSessionDate(s.session_date);
    const active = s.session_id === focusSelectedId ? 'active' : '';
    return `
    <div class="focus-card ${active}" data-id="${s.session_id}">
        <div class="sesh-time-line"><span class="bst-time">${d.display}</span></div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        ${buildStatusBadge(s)}
    </div>`;
}

function renderFocusDetail() {
    const detailEl = document.getElementById('focus-detail');
    if (!detailEl) return;
    const s = SESSIONS_DATA.find(x => x.session_id === focusSelectedId);
    if (!s) { detailEl.innerHTML = `<div class="focus-detail-empty"><i class="fas fa-hand-pointer"></i><p>Select a session on the left to view its details.</p></div>`; return; }

    const d = formatSessionDate(s.session_date);
    detailEl.innerHTML = `
        <div class="sesh-tile-top">${buildStatusBadge(s)}<span class="relative-badge">${d.relative}</span></div>
        <div class="sesh-title">${escapeHtml(s.session_name || 'Unnamed Session')}</div>
        ${s.session_desc ? `<div class="sesh-desc">${escapeHtml(s.session_desc)}</div>` : ''}
        <div class="sesh-time-line"><span class="bst-time">${d.display}</span></div>
        <div class="pill-row">${buildPillRow(s)}</div>
        ${buildTraineeListBlock(s)}
    `;
}

// ── Init ───────────────────────────────────────────────
renderGrid();