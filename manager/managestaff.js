    // managestaff.js
    // Renders every board defined in TABLE_CONFIG (see managestaff_tables.php), talks to
    // manage_records.php for list/create/update/delete, and to ../sessionongoing/conclude_session.php
    // for the Force Conclude action on the session_ongoing board.

    /* ============================= injected styles =============================
    Self-contained so this file is a drop-in — no managestaff.css edits needed.
    Adds: the sliding sidebar indicator, board fade/slide transitions, row
    stagger-in, and a small spinner. */
    (function injectStyles(){
    const css = `
    .ms-sidebar{position:relative;}
    .ms-board-indicator{position:absolute;top:0;left:8px;right:8px;height:0;border-radius:9px;
        background:rgba(124,196,255,.14);border:1px solid rgba(124,196,255,.25);
        transform:translateY(0);transition:transform .32s cubic-bezier(.34,1.1,.4,1),height .32s cubic-bezier(.34,1.1,.4,1),opacity .2s ease;
        pointer-events:none;opacity:0;z-index:0;}
    .ms-board-table-wrap{overflow-x:auto !important;}
    .ms-search-input{padding:9px 14px;border-radius:9px;background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.14);color:#fff;font:inherit;font-size:.83rem;width:220px;
        transition:width .2s ease,border-color .2s ease;}
    .ms-search-input:focus{outline:none;border-color:rgba(124,196,255,.5);width:260px;}
    .ms-search-input::placeholder{color:rgba(255,255,255,.3);}
    .ms-board-header-actions{display:flex;align-items:center;gap:10px;}
    .ms-board-btn{position:relative;z-index:1;}
    .ms-board-btn.active{background:transparent;}
    #board-content{transition:opacity .18s ease,transform .22s cubic-bezier(.2,.7,.3,1);}
    #board-content.ms-content-leaving{opacity:0;transform:translateY(6px);}
    #board-content.ms-content-entering{opacity:0;transform:translateY(10px);}
    #board-content.ms-content-visible{opacity:1;transform:translateY(0);}
    .ms-board-table tbody tr, .ms-card-grid .ms-record-card{
        animation:msRowIn .28s cubic-bezier(.2,.7,.3,1) backwards;}
    @keyframes msRowIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
    .ms-spinner-wrap{display:flex;align-items:center;justify-content:center;padding:70px 20px;color:rgba(255,255,255,.4);gap:12px;font-size:.85rem;}
    .ms-spinner{width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.15);border-top-color:#7cc4ff;animation:msSpin .7s linear infinite;}
    @keyframes msSpin{to{transform:rotate(360deg);}}
    .ms-row-btn{transition:transform .15s ease,background .15s ease,color .15s ease;}
    .ms-row-btn:active{transform:scale(.9);}
    .ms-add-btn{transition:transform .15s ease;}
    .ms-add-btn:active{transform:scale(.96);}
    .ms-modal{animation:msModalIn .22s cubic-bezier(.2,.7,.3,1);}
    @keyframes msModalIn{from{opacity:0;transform:translateY(14px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}
    .ms-json-summary{gap:4px;}
    .ms-conclude-btn{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;
        background:rgba(255,159,67,.14);border:1px solid rgba(255,159,67,.35);color:#ffb96e;
        font-size:.76rem;font-weight:600;cursor:pointer;font-family:inherit;margin-top:10px;width:100%;
        justify-content:center;transition:background .15s ease,transform .15s ease;}
    .ms-conclude-btn:hover{background:rgba(255,159,67,.24);}
    .ms-conclude-btn:active{transform:scale(.97);}
    .ms-locked-tag{font-size:.62rem;color:rgba(255,255,255,.35);margin-left:6px;font-weight:400;text-transform:none;letter-spacing:0;}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    })();

    /* ============================= state ============================= */
    let currentTable = null;
    let currentRows = [];
    let editingPk = null; // null => Add mode, otherwise Edit mode holding the pk value
    let searchTerm = '';

    const boardContent = document.getElementById('board-content');
    const boardTitle = document.getElementById('board-title');
    const boardSub = document.getElementById('board-sub');
    const addBtn = document.getElementById('board-add-btn');

    /* ============================= search bar ============================= */
    // Built dynamically so no managestaff.php edit is needed — wraps the existing
    // Add Record button together with a new search input in the board header.
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'board-search-input';
    searchInput.className = 'ms-search-input';
    searchInput.placeholder = 'Search this board…';
    searchInput.style.display = 'none';

    (function mountSearchBar(){
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'ms-board-header-actions';
    addBtn.parentNode.insertBefore(actionsWrap, addBtn);
    actionsWrap.appendChild(searchInput);
    actionsWrap.appendChild(addBtn);
    })();

    searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    applyFilterAndRender();
    });

    function rowMatchesSearch(row){
    if(!searchTerm) return true;
    return Object.values(row).some(v => {
    if(v === null || v === undefined) return false;
    return String(v).toLowerCase().includes(searchTerm);
    });
    }

    function applyFilterAndRender(){
    const cfg = TABLE_CONFIG[currentTable];
    if(!cfg || cfg.comingSoon) return;
    const filtered = currentRows.filter(rowMatchesSearch);
    boardSub.textContent = searchTerm
    ? `${filtered.length} of ${currentRows.length} record${currentRows.length === 1 ? '' : 's'} matching "${searchInput.value.trim()}"`
    : `${currentRows.length} record${currentRows.length === 1 ? '' : 's'}`;
    renderBoard(cfg, filtered);
    }

    /* ============================= toasts ============================= */
    function showToast(message, type = 'success'){
    const container = document.getElementById('toast-container');
    if(!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> ${message}`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
    }, 3200);
    }

    /* ============================= profile popup ============================= */
    (function initProfilePopup(){
    const btn = document.getElementById('profile-btn');
    const popup = document.getElementById('profile-popup');
    const chev = document.getElementById('chev');
    if(!btn || !popup) return;
    btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.toggle('open');
    chev?.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
    if(!popup.contains(e.target) && !btn.contains(e.target)){
        popup.classList.remove('open');
        chev?.classList.remove('open');
    }
    });
    })();

    /* ============================= sidebar sliding indicator ============================= */
    const sidebar = document.querySelector('.ms-sidebar');
    let indicatorEl = null;
    function ensureIndicator(){
    if(indicatorEl) return indicatorEl;
    indicatorEl = document.createElement('div');
    indicatorEl.className = 'ms-board-indicator';
    sidebar.insertBefore(indicatorEl, sidebar.firstChild);
    return indicatorEl;
    }
    function moveIndicatorTo(btn){
    const ind = ensureIndicator();
    if(!btn){ ind.style.opacity = '0'; return; }
    const sidebarRect = sidebar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    ind.style.opacity = '1';
    ind.style.transform = `translateY(${btnRect.top - sidebarRect.top}px)`;
    ind.style.height = `${btnRect.height}px`;
    }
    window.addEventListener('resize', () => {
    const active = document.querySelector('.ms-board-btn.active');
    if(active) moveIndicatorTo(active);
    });

    /* ============================= board switching ============================= */
    document.querySelectorAll('.ms-board-btn').forEach(btn => {
    btn.addEventListener('click', () => {
    if(btn.classList.contains('active')) return;
    const table = btn.dataset.table;
    document.querySelectorAll('.ms-board-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    moveIndicatorTo(btn);
    selectBoard(table);
    });
    });

    function transitionBoardContent(renderFn){
    boardContent.classList.add('ms-content-leaving');
    setTimeout(() => {
    renderFn();
    boardContent.classList.remove('ms-content-leaving');
    boardContent.classList.add('ms-content-entering');
    requestAnimationFrame(() => {
        boardContent.classList.remove('ms-content-entering');
        boardContent.classList.add('ms-content-visible');
    });
    }, 160);
    }

    async function selectBoard(table){
    currentTable = table;
    editingPk = null;
    searchTerm = '';
    searchInput.value = '';
    const cfg = TABLE_CONFIG[table];
    if(!cfg) return;

    boardTitle.textContent = cfg.label;

    if(cfg.comingSoon){
    boardSub.textContent = 'Not built yet.';
    addBtn.style.display = 'none';
    searchInput.style.display = 'none';
    transitionBoardContent(() => renderComingSoon());
    return;
    }

    addBtn.style.display = cfg.readOnly ? 'none' : 'flex';
    searchInput.style.display = 'block';
    boardSub.textContent = 'Loading…';
    transitionBoardContent(() => renderLoading());

    try {
    const res = await fetch(`manage_records.php?table=${encodeURIComponent(table)}`);
    const data = await res.json();
    if(!data.success){
        boardSub.textContent = data.message || 'Failed to load.';
        transitionBoardContent(() => renderError(data.message));
        return;
    }
    currentRows = data.rows || [];
    boardSub.textContent = `${currentRows.length} record${currentRows.length === 1 ? '' : 's'}`;
    transitionBoardContent(() => renderBoard(cfg, currentRows));
    } catch (err) {
    boardSub.textContent = 'Failed to load.';
    transitionBoardContent(() => renderError(String(err)));
    }
    }

    /* ============================= renderers ============================= */
    function renderLoading(){
    boardContent.innerHTML = `<div class="ms-spinner-wrap"><div class="ms-spinner"></div> Loading board…</div>`;
    }

    function renderError(message){
    boardContent.innerHTML = `
    <div class="ms-empty">
        <i class="fas fa-triangle-exclamation" style="font-size:1.6rem;"></i>
        <div>${escapeHtml(message || 'Something went wrong.')}</div>
    </div>`;
    }

    function renderComingSoon(){
    boardContent.innerHTML = `
    <div class="ms-coming-soon-panel">
        <i class="fas fa-hammer"></i>
        <div>This board hasn't been built yet — check back soon.</div>
    </div>`;
    }

    function renderBoard(cfg, rows){
    if(cfg.readOnly){
    boardContent.innerHTML = `<div class="ms-readonly-banner"><i class="fas fa-circle-info"></i> ${escapeHtml(cfg.readOnlyReason || 'This table is read-only here.')}</div>`;
    } else {
    boardContent.innerHTML = '';
    }

    if(rows.length === 0){
    boardContent.insertAdjacentHTML('beforeend', `
        <div class="ms-empty">
        <i class="fas fa-inbox" style="font-size:1.6rem;"></i>
        <div>No records yet.</div>
        </div>`);
    return;
    }

    if(cfg.displayMode === 'cards'){
    renderCards(cfg, rows);
    } else {
    renderTable(cfg, rows);
    }
    }

    function renderCards(cfg, rows){
    const wrap = document.createElement('div');
    wrap.className = 'ms-card-grid';
    rows.forEach((row, i) => {
    const card = document.createElement('div');
    card.className = 'ms-record-card';
    card.style.animationDelay = `${Math.min(i * 30, 300)}ms`;

    const titleCol = Object.keys(cfg.columns)[1] || cfg.primaryKey;
    card.innerHTML = `<div class="ms-record-card-title">${escapeHtml(row[titleCol] ?? row[cfg.primaryKey] ?? 'Record')}</div>`;

    Object.entries(cfg.columns).forEach(([col, def]) => {
        if(col === titleCol) return;
        card.insertAdjacentHTML('beforeend', `
        <div class="ms-card-field">
            <span class="ms-card-field-label">${escapeHtml(def.label)}</span>
            <span>${formatCell(def, row[col])}</span>
        </div>`);
    });

    if(cfg.primaryKey === 'session_id' && currentTable === 'session_ongoing'){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ms-conclude-btn';
        btn.innerHTML = '<i class="fas fa-flag-checkered"></i> Force Conclude';
        btn.addEventListener('click', () => forceConcludeSession(row.session_id, card));
        card.appendChild(btn);
    }

    wrap.appendChild(card);
    });
    boardContent.appendChild(wrap);
    }

    function renderTable(cfg, rows){
    const wrapEl = document.createElement('div');
    wrapEl.className = 'ms-board-table-wrap';
    const cols = Object.entries(cfg.columns);

    const thead = cols.map(([, def]) => `<th>${escapeHtml(def.label)}</th>`).join('');
    const actionsHead = cfg.readOnly ? '' : `<th style="width:80px;"></th>`;

    wrapEl.innerHTML = `
    <table class="ms-board-table">
        <thead><tr>${thead}${actionsHead}</tr></thead>
        <tbody></tbody>
    </table>`;
    const tbody = wrapEl.querySelector('tbody');

    rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${Math.min(i * 25, 300)}ms`;
    tr.innerHTML = cols.map(([col, def]) => `<td>${formatCell(def, row[col])}</td>`).join('');

    if(!cfg.readOnly){
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `
        <div class="ms-row-actions">
            <button type="button" class="ms-row-btn" title="Edit"><i class="fas fa-pen"></i></button>
            <button type="button" class="ms-row-btn danger" title="Delete"><i class="fas fa-trash"></i></button>
        </div>`;
        actionsTd.querySelector('.ms-row-btn:not(.danger)').addEventListener('click', () => openRecordModal(cfg, row));
        actionsTd.querySelector('.ms-row-btn.danger').addEventListener('click', () => confirmDelete(cfg, row));
        tr.appendChild(actionsTd);
    }

    tbody.appendChild(tr);
    });

    boardContent.appendChild(wrapEl);
    }

    /* ============================= cell formatting ============================= */
    const PILL_PALETTE_SIZE = 6;
    function pillClassFor(value, options){
    if(Array.isArray(options)){
    const idx = options.indexOf(value);
    return `ms-pill-${idx >= 0 ? idx % PILL_PALETTE_SIZE : 0}`;
    }
    // stable hash for free-text pill values (e.g. session_status)
    let hash = 0;
    const str = String(value ?? '');
    for(let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return `ms-pill-${hash % PILL_PALETTE_SIZE}`;
    }

    function formatCell(def, value){
    if(value === null || value === undefined || value === ''){
    return '<span style="color:rgba(255,255,255,.25);">—</span>';
    }
    switch(def.type){
    case 'bool':
        return Number(value)
        ? '<i class="fas fa-circle-check ms-bool-true"></i>'
        : '<i class="fas fa-circle-xmark ms-bool-false"></i>';
    case 'select':
        if(def.pill) return `<span class="ms-pill ${pillClassFor(value, def.options)}">${escapeHtml(value)}</span>`;
        return escapeHtml(value);
    case 'text':
        if(def.pill) return `<span class="ms-pill ${pillClassFor(value, def.options)}">${escapeHtml(value)}</span>`;
        return escapeHtml(value);
    case 'staff_roster_json':
        return formatStaffRosterJson(value);
    case 'feedback_json':
        return formatFeedbackJson(value);
    case 'textarea':
        return `<span title="${escapeHtml(value)}">${escapeHtml(truncate(value, 60))}</span>`;
    default:
        return escapeHtml(String(value));
    }
    }

    function truncate(str, n){
    str = String(str);
    return str.length > n ? str.slice(0, n) + '…' : str;
    }

    // The Full Roster column stores a JSON snapshot of everyone who worked the session.
    // Shape isn't guaranteed field-by-field, so this reads generously: an array of role/name-ish
    // objects, or a flat object of role -> name, and falls back to raw text if neither fits.
    function formatStaffRosterJson(raw){
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return `<span title="${escapeHtml(String(raw))}">${escapeHtml(truncate(String(raw), 40))}</span>`; }

    const lines = [];
    if(Array.isArray(parsed)){
    parsed.forEach(entry => {
        if(entry && typeof entry === 'object'){
        const role = entry.role || entry.position || 'Staff';
        const name = entry.name || entry.discord || entry.display_name || entry.discordName || '—';
        lines.push(`<b>${escapeHtml(role)}:</b> ${escapeHtml(name)}`);
        } else {
        lines.push(escapeHtml(String(entry)));
        }
    });
    } else if(parsed && typeof parsed === 'object'){
    Object.entries(parsed).forEach(([role, name]) => {
        lines.push(`<b>${escapeHtml(role)}:</b> ${escapeHtml(typeof name === 'object' ? JSON.stringify(name) : name)}`);
    });
    }
    if(lines.length === 0) return '<span style="color:rgba(255,255,255,.25);">—</span>';
    return `<div class="ms-json-summary">${lines.map(l => `<div class="ms-json-line">${l}</div>`).join('')}</div>`;
    }

    // Feedback is stored with a known-ish shape (setup / conflict / priority / rbtiming / overall /
    // notes / trains / setupSeconds) per the session-conclude flow, but new fields shouldn't break
    // this — anything unrecognized still prints as a plain label:value line.
    const FEEDBACK_FIELD_LABELS = {
    setup: 'Setup', conflict: 'Conflict Handling', priority: 'Prioritization',
    rbtiming: 'RB Timing', overall: 'Overall', notes: 'Notes',
    trains: 'Trains', setupSeconds: 'Setup Time (s)',
    };
    function formatFeedbackJson(raw){
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return `<span title="${escapeHtml(String(raw))}">${escapeHtml(truncate(String(raw), 40))}</span>`; }
    if(!parsed || typeof parsed !== 'object') return '<span style="color:rgba(255,255,255,.25);">—</span>';

    const lines = Object.entries(parsed)
    .filter(([, v]) => v !== null && v !== '' && v !== undefined)
    .map(([key, v]) => `<b>${escapeHtml(FEEDBACK_FIELD_LABELS[key] || key)}:</b> ${escapeHtml(String(v))}`);
    if(lines.length === 0) return '<span style="color:rgba(255,255,255,.25);">No feedback filled in</span>';
    return `<div class="ms-json-summary">${lines.map(l => `<div class="ms-json-line">${l}</div>`).join('')}</div>`;
    }

    function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    /* ============================= record modal (add / edit) ============================= */
    const modalBackdrop = document.getElementById('record-modal-backdrop');
    const modalTitle = document.getElementById('record-modal-title');
    const modalBody = document.getElementById('record-modal-body');
    const modalClose = document.getElementById('record-modal-close');
    const modalCancel = document.getElementById('record-cancel-btn');
    const modalSave = document.getElementById('record-save-btn');

    addBtn.addEventListener('click', () => {
    const cfg = TABLE_CONFIG[currentTable];
    if(cfg) openRecordModal(cfg, null);
    });

    function fieldEditableNow(def, isEdit){
    if(isEdit && def.editableOnUpdate === false) return false;
    if(!isEdit && def.editableOnCreate === false) return false;
    if(def.minLevel && MY_PERM_LEVEL < def.minLevel) return false;
    return true;
    }

    function openRecordModal(cfg, row){
    const isEdit = !!row;
    editingPk = isEdit ? row[cfg.primaryKey] : null;
    modalTitle.textContent = isEdit ? `Edit ${cfg.label}` : `Add ${cfg.label}`;
    modalBody.innerHTML = '';

    Object.entries(cfg.columns).forEach(([col, def]) => {
    if(col === cfg.primaryKey && isEdit){
        // pk is shown, locked, never resubmitted
        modalBody.insertAdjacentHTML('beforeend', buildFieldGroup(col, def, row[col], true));
        return;
    }
    if(!isEdit && def.editableOnCreate === false) return; // matches manage_records.php's own create filter
    const editable = fieldEditableNow(def, isEdit);
    modalBody.insertAdjacentHTML('beforeend', buildFieldGroup(col, def, row ? row[col] : '', !editable));
    });

    modalBackdrop.classList.add('open');
    }

    function buildFieldGroup(col, def, value, locked){
    const lockedTag = locked ? '<span class="ms-locked-tag">(locked)</span>' : '';
    let input;
    switch(def.type){
    case 'bool':
        input = `<input type="checkbox" data-col="${col}" ${Number(value) ? 'checked' : ''} ${locked ? 'disabled' : ''} style="width:18px;height:18px;"/>`;
        break;
    case 'select':
        input = `<select data-col="${col}" ${locked ? 'disabled' : ''}>
        ${(def.options || []).map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>`;
        break;
    case 'textarea':
    case 'staff_roster_json':
    case 'feedback_json':
        input = `<textarea data-col="${col}" ${locked ? 'disabled' : ''}>${escapeHtml(value ?? '')}</textarea>`;
        break;
    case 'number':
        input = `<input type="number" data-col="${col}" value="${value ?? ''}" ${locked ? 'disabled' : ''}/>`;
        break;
    case 'date':
        input = `<input type="date" data-col="${col}" value="${escapeHtml(value ?? '')}" ${locked ? 'disabled' : ''}/>`;
        break;
    default:
        input = `<input type="text" data-col="${col}" value="${escapeHtml(value ?? '')}" ${locked ? 'disabled' : ''}/>`;
    }
    return `<div class="ms-form-group ${locked ? 'locked' : ''}"><label>${escapeHtml(def.label)}${lockedTag}</label>${input}</div>`;
    }

    function closeRecordModal(){
    modalBackdrop.classList.remove('open');
    editingPk = null;
    }
    modalClose.addEventListener('click', closeRecordModal);
    modalCancel.addEventListener('click', closeRecordModal);
    modalBackdrop.addEventListener('click', (e) => { if(e.target === modalBackdrop) closeRecordModal(); });

    modalSave.addEventListener('click', async () => {
    const cfg = TABLE_CONFIG[currentTable];
    if(!cfg) return;
    const data = {};
    modalBody.querySelectorAll('[data-col]').forEach(el => {
    if(el.disabled) return;
    const col = el.dataset.col;
    if(el.type === 'checkbox') data[col] = el.checked ? 1 : 0;
    else data[col] = el.value;
    });

    const isEdit = editingPk !== null;
    try {
    const res = await fetch('manage_records.php', {
        method: isEdit ? 'PUT' : 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(isEdit
        ? { table: currentTable, pk: editingPk, data }
        : { table: currentTable, data }),
    });
    const result = await res.json();
    if(result.success){
        showToast(isEdit ? 'Record updated.' : 'Record added.', 'success');
        closeRecordModal();
        selectBoard(currentTable);
    } else {
        showToast(result.message || 'Save failed.', 'error');
    }
    } catch (err) {
    showToast('Save failed.', 'error');
    }
    });

    /* ============================= delete confirm ============================= */
    const confirmBackdrop = document.getElementById('confirm-modal-backdrop');
    const confirmCancel = document.getElementById('confirm-cancel-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    let pendingDelete = null;

    function confirmDelete(cfg, row){
    pendingDelete = { table: currentTable, pk: row[cfg.primaryKey] };
    confirmBackdrop.classList.add('open');
    }
    confirmCancel.addEventListener('click', () => { confirmBackdrop.classList.remove('open'); pendingDelete = null; });
    confirmBackdrop.addEventListener('click', (e) => { if(e.target === confirmBackdrop){ confirmBackdrop.classList.remove('open'); pendingDelete = null; } });

    confirmDeleteBtn.addEventListener('click', async () => {
    if(!pendingDelete) return;
    try {
    const res = await fetch('manage_records.php', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(pendingDelete),
    });
    const result = await res.json();
    confirmBackdrop.classList.remove('open');
    if(result.success){
        showToast('Record deleted.', 'success');
        selectBoard(currentTable);
    } else {
        showToast(result.message || 'Delete failed.', 'error');
    }
    } catch (err) {
    confirmBackdrop.classList.remove('open');
    showToast('Delete failed.', 'error');
    }
    pendingDelete = null;
    });

    /* ============================= force conclude (session_ongoing) ============================= */
    async function forceConcludeSession(sessionId, cardEl){
    if(!confirm(`Force conclude session #${sessionId}? This archives it into the session logs and removes it from live sessions — this can't be undone.`)) return;
    cardEl.style.opacity = '.5';
    cardEl.style.pointerEvents = 'none';
    try {
    const res = await fetch('../sessionongoing/conclude_session.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ session_id: sessionId }),
    });
    const result = await res.json();
    if(result.success){
        showToast(`Session #${sessionId} concluded.`, 'success');
        selectBoard(currentTable);
    } else {
        showToast(result.message || 'Force conclude failed.', 'error');
        cardEl.style.opacity = '1';
        cardEl.style.pointerEvents = 'auto';
    }
    } catch (err) {
    showToast('Force conclude failed.', 'error');
    cardEl.style.opacity = '1';
    cardEl.style.pointerEvents = 'auto';
    }
    }

    /* ============================= escape key closes modals ============================= */
    document.addEventListener('keydown', (e) => {
    if(e.key !== 'Escape') return;
    if(modalBackdrop.classList.contains('open')) closeRecordModal();
    if(confirmBackdrop.classList.contains('open')){ confirmBackdrop.classList.remove('open'); pendingDelete = null; }
    });

    /* ============================= initial state ============================= */
    (function selectFirstAvailableBoard(){
    const firstBtn = document.querySelector('.ms-board-btn');
    if(firstBtn){
    firstBtn.classList.add('active');
    requestAnimationFrame(() => moveIndicatorTo(firstBtn));
    selectBoard(firstBtn.dataset.table);
    }
    })();