// ── Profile popup (same pattern as dashboard.js) ──
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = profilePopup.classList.toggle('open');
    chev.classList.toggle('open', isOpen);
});
document.addEventListener('click', (e) => {
    if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});

// ── Back button: previous tab/page, not a fixed dashboard link ──
document.getElementById('back-btn').addEventListener('click', () => {
    if (document.referrer && document.referrer.indexOf(window.location.origin) === 0) {
        window.location.href = document.referrer;
    } else {
        history.back();
    }
});

// ── Notifications timeline ──
const CAT_CLASS = {
    Session: 'cat-session', Event: 'cat-event', Website: 'cat-website',
    System: 'cat-system', Manager: 'cat-manager', Admin: 'cat-admin', Update: 'cat-update',
};

function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDate(sqlDatetime){
    const d = new Date(sqlDatetime.replace(' ', 'T'));
    const dateStr = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    return dateStr;
}

function renderRow(n){
    const catClass = CAT_CLASS[n.category] || 'cat-system';
    const el = document.createElement('div');
    el.className = 'notif-row';
    el.innerHTML = `
        <div class="notif-tag ${catClass}">${escapeHtml(n.category.slice(0, 3).toUpperCase())}</div>
        <div class="notif-body">
            <div class="notif-title"><b>${escapeHtml(n.title)}</b></div>
            <div class="notif-desc" title="${escapeHtml(n.description)}">${escapeHtml(n.description)}</div>
        </div>
        <div class="notif-date-col">
            <span class="notif-date-dot"></span>
            ${escapeHtml(formatDate(n.posted_at))}
        </div>
    `;
    return el;
}

const timelineEl = document.getElementById('notif-timeline');
const loadMoreBtn = document.getElementById('notif-loadmore-btn');
const emptyEl = document.getElementById('notif-empty');

let loadedCount = 0;

function appendRows(rows){
    rows.forEach(n => timelineEl.appendChild(renderRow(n)));
    loadedCount += rows.length;
}

// Initial page, server-rendered data
appendRows(INITIAL_NOTIFICATIONS);
if (loadedCount >= TOTAL_NOTIF_COUNT) {
    loadMoreBtn.style.display = 'none';
    emptyEl.style.display = 'block';
}

loadMoreBtn.addEventListener('click', async () => {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';
    try {
        const res = await fetch(`notifications_fetch.php?offset=${loadedCount}`);
        const data = await res.json();
        if (data.success) {
            appendRows(data.rows);
            if (data.rows.length < PAGE_SIZE || loadedCount >= TOTAL_NOTIF_COUNT) {
                loadMoreBtn.style.display = 'none';
                emptyEl.style.display = 'block';
            }
        }
    } finally {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load more notifications';
    }
});