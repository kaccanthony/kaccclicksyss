// sessionongoing.js
/* ================= STATE ================= */
const staffRoles = ['Main AST','Assistant','Co-Host','Internal Helper'];
let staffCount = 0;
let driverCount = 0;
let traineeCount = 0;
const timers = {};
const overrides = { 'session-details':false, 'trainees':false, 'staff-roles':false, 'drivers-disable':false, 'slot-order':false, 'staff-delete':false, 'trainee-details':false, 'trainer-details':false, 'allow-all':false };

const myRole = MY_ROLE; // 'host' | 'cohost' | 'assistant' — set server-side in sessionongoing.php
const isHost = myRole === 'host';

const myClientId = (function(){
  let id = localStorage.getItem('yss_client_id');
  if(!id){ id = 'c_' + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem('yss_client_id', id); }
  return id;
})();

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

const staffDelBtn = document.querySelector('.ovr-btn[data-ovr="staff-delete"]');
if(staffDelBtn && isHost) staffDelBtn.classList.add('visible');
const allowAllBtn = document.querySelector('.ovr-btn[data-ovr="allow-all"]');
if(allowAllBtn && isHost) allowAllBtn.classList.add('visible');
const concludePanel = document.getElementById('conclude-panel');
if(concludePanel && isHost) concludePanel.classList.add('visible');
const sessionControlsPanel = document.getElementById('session-controls-panel');
if(sessionControlsPanel && isHost) sessionControlsPanel.classList.add('visible');
/* ================= ANNOUNCEMENT TEMPLATE (must exist before the first trainee rows are built below) ================= */
const ANNOUNCEMENT_TEMPLATE = `# 📢 Zone Announcement
**Zone:** [ZONE]
**Trainee:** [TRAINEE]
____
[TRAINEE] is currently signalling at **[ZONE]**. Please give way and avoid interfering with the session.`;

/* ================= TOASTS ================= */
const toastContainer = document.getElementById('toast-container');
function showToast(message){
  if(!toastContainer) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const msgEl = document.createElement('div');
  msgEl.className = 'toast-msg';
  msgEl.innerHTML = '<i class="fas fa-lock"></i> ';
  msgEl.appendChild(document.createTextNode(message));
  const barWrap = document.createElement('div');
  barWrap.className = 'toast-bar';
  const barFill = document.createElement('div');
  barFill.className = 'toast-bar-fill';
  barWrap.appendChild(barFill);
  el.appendChild(msgEl);
  el.appendChild(barWrap);
  toastContainer.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('show'));
  const TOAST_MS = 3000;
  const removeTimer = setTimeout(()=>{
    el.classList.add('hide');
    setTimeout(()=> el.remove(), 250);
  }, TOAST_MS);
  // allow dismissing early by click
  el.addEventListener('click', ()=>{
    clearTimeout(removeTimer);
    el.classList.add('hide');
    setTimeout(()=> el.remove(), 250);
  });
}

/* ================= CONFIRM MODAL ================= */
const confirmModal = document.getElementById('confirm-modal');
let confirmResolver = null;
function showConfirm(message, title, isHtml){
  document.getElementById('confirm-title').textContent = title || 'Are you sure?';
  const msgEl = document.getElementById('confirm-message');
  if(isHtml) msgEl.innerHTML = message; else msgEl.textContent = message;
  confirmModal.classList.remove('closing');
  confirmModal.classList.add('open');
  return new Promise(resolve=>{ confirmResolver = resolve; });
}
function closeConfirm(result){
  confirmModal.classList.add('closing');
  confirmModal.classList.remove('open');
  setTimeout(()=> confirmModal.classList.remove('closing'), 200);
  if(confirmResolver){ confirmResolver(result); confirmResolver = null; }
}
document.getElementById('confirm-ok').addEventListener('click', ()=> closeConfirm(true));
document.getElementById('confirm-cancel').addEventListener('click', ()=> closeConfirm(false));
confirmModal.addEventListener('click', (e)=>{ if(e.target === confirmModal) closeConfirm(false); });

/* ================= LOCK HELPERS ================= */
function setLocked(el, locked){
  if(!el) return;
  el.classList.toggle('is-locked', locked);
  if(el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'button'){
    el.readOnly = locked;
  }
}

// Any element carrying both .is-locked and data-lock-msg will show a toast instead of responding.
document.addEventListener('mousedown', (e)=>{
  const el = e.target.closest('.is-locked[data-lock-msg]');
  if(el){
    e.preventDefault();
    showToast(el.dataset.lockMsg);
  }
}, true);

/* ================= OVERRIDE TOGGLES ================= */
document.querySelectorAll('.ovr-btn').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const key = btn.dataset.ovr;
    if(key === 'allow-all' && !overrides[key]){
      const ok = await showConfirm(
        'This unlocks every field for every user and bypasses all individual overrides, including host-only ones. This can\'t be undone quietly — everyone will be able to edit everything.',
        'Allow Override for Everyone?'
      );
      if(!ok) return;
    }
    overrides[key] = !overrides[key];
    btn.classList.toggle('on', overrides[key]);
    applyOverrides();
    queueLiveStateSync();
  });
});

function applyOverrides(){
  const allowAll = overrides['allow-all'];

  // Session details lock
  const sessionUnlocked = allowAll || overrides['session-details'];
  document.querySelectorAll('.details-field').forEach(f=> setLocked(f, !sessionUnlocked));
  const tag = document.getElementById('details-lock-tag');
  if(sessionUnlocked){
    tag.className = 'lock-tag is-unlocked';
    tag.innerHTML = '<i class="fas fa-lock-open"></i> Unlocked (override active)';
  } else {
    tag.className = 'lock-tag is-locked';
    tag.innerHTML = '<i class="fas fa-lock"></i> Locked';
  }

  // Trainee add button
  const traineesUnlocked = allowAll || overrides['trainees'];
  const addTraineeBtn = document.getElementById('add-trainee-btn');
  setLocked(addTraineeBtn, !traineesUnlocked);
  addTraineeBtn.innerHTML = traineesUnlocked
    ? '<i class="fas fa-plus"></i> Add unallocated trainee'
    : '<i class="fas fa-plus"></i> Add unallocated trainee (requires Override Trainees)';

  // Trainee row delete — same override as adding trainees
  document.querySelectorAll('.trainee-del-btn').forEach(b => setLocked(b, !traineesUnlocked));

  // Staff row delete — host + staff-delete override required
  const staffDeleteUnlocked = allowAll || (isHost && overrides['staff-delete']);
  document.querySelectorAll('.staff-del-btn').forEach(b => setLocked(b, !staffDeleteUnlocked));

  // Staff role selects
  const staffRolesUnlocked = allowAll || overrides['staff-roles'];
  document.querySelectorAll('.staff-role-select').forEach(s=> setLocked(s, !staffRolesUnlocked));

  // Trainee detail fields (Discord, Discord ID, Roblox, Zone)
  const traineeDetailsUnlocked = allowAll || overrides['trainee-details'];
  document.querySelectorAll('.trainee-detail-field').forEach(f=> setLocked(f, !traineeDetailsUnlocked));

  // Trainer assignment fields (Trainer name, Trainer Discord ID)
  const trainerDetailsUnlocked = allowAll || overrides['trainer-details'];
  document.querySelectorAll('.trainer-detail-field').forEach(f=> setLocked(f, !trainerDetailsUnlocked));

  // Driver inputs (inverted: this override *disables* them when on)
  const driversLocked = !allowAll && overrides['drivers-disable'];
  document.querySelectorAll('.driver-field').forEach(f=> setLocked(f, driversLocked));

  // Slot order buttons
  const slotOrderUnlocked = allowAll || overrides['slot-order'];
  document.querySelectorAll('.order-btn').forEach(b=> setLocked(b, !slotOrderUnlocked));


  // Host Discord ID — always locked, only "Allow Override for Everyone" unlocks it
  setLocked(document.getElementById('session-host-discordid'), !allowAll);
  updateStatusLockState();
}


function updateStatusLockState(){
  const statusSelect = document.getElementById('status-select');
  const hint = document.getElementById('status-unlock-hint');
  if(!statusSelect) return;
  const rows = document.querySelectorAll('#trainee-rows tr');
  const allDone = rows.length > 0 && Array.from(rows).every(tr => tr.querySelector('.complete-btn')?.classList.contains('done'));
  const sessionUnlocked = overrides['allow-all'] || overrides['session-details'];
  const unlocked = sessionUnlocked || allDone;
  setLocked(statusSelect, !unlocked);
  statusSelect.dataset.lockMsg = unlocked ? '' : 'Session status unlocks once every trainee is marked done, or via Override Session Details.';
  if(hint){
    hint.textContent = sessionUnlocked
      ? 'Unlocked — Override Session Details active'
      : allDone
        ? 'Unlocked — all trainees marked done'
        : 'Locked — unlocks once all trainees are marked done';
  }
}

function applySignalMinutes(){
  const input = document.getElementById('signal-time-input');
  if(!input || input.classList.contains('is-locked')) return;
  const minutes = Math.max(1, parseInt(input.value, 10) || 12);
  COUNTDOWN_START = minutes * 60;
  document.querySelectorAll('#trainee-rows tr').forEach(tr=>{
    const row = tr.dataset.row;
    const t = timers[row];
    if(!t) return;
    t.totalMinutes = minutes;
    t.seconds = COUNTDOWN_START;
    t.running = false;
    clearInterval(t.interval);
    const rowPlayBtn = tr.querySelector('.timer-btn.play');
    if(rowPlayBtn){ rowPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; rowPlayBtn.classList.remove('active'); }
    updateTimerDisplay(row);
  });
  showToast(`Signal time set to ${minutes} minutes for all trainees.`);
}

/* ================= STATUS BADGE ================= */
const statusMap = {
  inprogress: {label:'In Progress', cls:'status-inprogress'},
  paused: {label:'Paused', cls:'status-paused'},
  cancelled: {label:'Cancelled', cls:'status-cancelled'},
  concluded: {label:'Concluded', cls:'status-concluded'},
};
document.getElementById('status-select').addEventListener('change', (e)=>{
  const s = statusMap[e.target.value];
  const badge = document.getElementById('status-badge');
  badge.className = 'status-badge ' + s.cls;
  badge.innerHTML = `<span class="status-dot"></span> ${s.label}`;
});

/* ================= TRAINEE ROWS ================= */
const zones = ['Zone 1','Zone 2','Zone 3','Zone 4', 'Zone 5','Zone 6','Zone 7','Zone 8','Zone 9','Zone 10'];
let COUNTDOWN_START = (parseInt(SESSION_DATA.trainee_timer, 10) || 12) * 60; // from session_ongoing.trainee_timer

const fbZoneSelect = document.getElementById('fb-zone');
if(fbZoneSelect){
  fbZoneSelect.innerHTML = '<option>Select</option>' + zones.map(z=>`<option>${z}</option>`).join('');
}

function fmt(s){
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(s);
  const m = String(Math.floor(abs/60)).padStart(2,'0');
  const sec = String(abs%60).padStart(2,'0');
  return `${sign}${m}:${sec}`;
}

// Timer model: { remainingSeconds, running, syncedAt (ms epoch), setupSeconds }
// remainingSeconds is the authoritative value as of syncedAt. While running, the
// live value is derived from wall-clock time, so every viewer computes the same
// number regardless of when their last poll happened — no drift between clients.
function computeCurrentRemaining(t) {
    if (!t.running) return t.remainingSeconds;
    const elapsed = Math.floor((Date.now() - t.syncedAt) / 1000);
    return Math.max(0, t.remainingSeconds - elapsed);
}

function updateTimerDisplay(row) {
    const t = timers[row];
    if (!t) return;
    const live = computeCurrentRemaining(t);
    const rowDisplay = document.querySelector(`[data-timer="${row}"]`);
    if (rowDisplay) {
        rowDisplay.textContent = fmt(live);
        rowDisplay.classList.toggle('running', live > 60 && t.running);
        rowDisplay.classList.toggle('low', live <= 60 && live > 0);
        rowDisplay.classList.toggle('expired', live <= 0);
    }
    updateModalTimerIfOpen(row);
}

function toggleTimer(row) {
    const t = timers[row];
    if (!t) return;
    const rowPlayBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
    if (!t.running) {
        t.running = true;
        t.syncedAt = Date.now();
        if (rowPlayBtn) { rowPlayBtn.innerHTML = '<i class="fas fa-pause"></i>'; rowPlayBtn.classList.add('active'); }
        syncModalPlayBtn(row, true);
    } else {
        t.remainingSeconds = computeCurrentRemaining(t);
        t.running = false;
        if (rowPlayBtn) { rowPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; rowPlayBtn.classList.remove('active'); }
        syncModalPlayBtn(row, false);
    }
    updateTimerDisplay(row);
    queueLiveStateSync();
}

function resetTimer(row) {
    const t = timers[row];
    if (!t) return;
    t.running = false;
    t.remainingSeconds = COUNTDOWN_START;
    t.syncedAt = Date.now();
    const rowPlayBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
    if (rowPlayBtn) { rowPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; rowPlayBtn.classList.remove('active'); }
    syncModalPlayBtn(row, false);
    updateTimerDisplay(row);
    queueLiveStateSync();
}

function setTimerValue(row, mmss) {
    const t = timers[row];
    if (!t) return;
    const parts = String(mmss).split(':').map(n => parseInt(n, 10) || 0);
    t.remainingSeconds = parts.length === 2 ? (parts[0] * 60 + parts[1]) : (parseInt(mmss, 10) || 0);
    t.syncedAt = Date.now();
    updateTimerDisplay(row);
    queueLiveStateSync();
}

function syncModalPlayBtn(row, running) {
    if (String(activeFeedbackRow) !== String(row)) return;
    const btn = document.getElementById('fb-timer-toggle');
    if (!btn) return;
    btn.innerHTML = running ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    btn.classList.toggle('active', running);
}

function updateModalTimerIfOpen(row) {
    if (String(activeFeedbackRow) !== String(row)) return;
    const disp = document.getElementById('fb-timer-display');
    if (disp) disp.textContent = fmt(computeCurrentRemaining(timers[row]));
}

function recordSetupDone(row) {
    const t = timers[row];
    if (!t) return;
    t.setupSeconds = Math.max(0, COUNTDOWN_START - computeCurrentRemaining(t));
    updateModalSetupTimeIfOpen(row);
    queueLiveStateSync();
}

function syncModalSetupDoneBtn(row, done) {
    if (String(activeFeedbackRow) !== String(row)) return;
    const btn = document.getElementById('fb-setup-done');
    if (btn) btn.classList.toggle('done', done);
}

function overrideSetupTime(row) {
    const t = timers[row];
    if (!t) return;
    const current = t.setupSeconds !== undefined ? fmt(t.setupSeconds) : '00:00';
    const input = prompt('Override setup time (MM:SS):', current);
    if (input === null) return;
    const parts = String(input).split(':').map(n => parseInt(n, 10) || 0);
    t.setupSeconds = parts.length === 2 ? (parts[0] * 60 + parts[1]) : (parseInt(input, 10) || 0);
    updateModalSetupTimeIfOpen(row);
    queueLiveStateSync();
}

function updateModalSetupTimeIfOpen(row) {
    if (String(activeFeedbackRow) !== String(row)) return;
    const input = document.getElementById('fb-setup-time');
    if (input) input.value = fmt(timers[row].setupSeconds);
}

// Local 1s ticker — purely re-renders the display from wall-clock time; never
// mutates remainingSeconds itself, so it can't drift or fight with sync.
setInterval(() => {
    Object.keys(timers).forEach(row => { if (timers[row].running) updateTimerDisplay(row); });
}, 1000);

function addTraineeRow(unallocated){
  const idx = traineeCount++;
  const tr = document.createElement('tr');
  tr.dataset.row = idx;
  tr.innerHTML = `
    <td>
      <div class="slot-cell" style="display:flex;align-items:center;justify-content:center;">
        <button class="order-btn" data-dir="up" data-row="${idx}" data-lock-msg="Slot ordering is locked. Ask the host to enable Override Slot Ordering."><i class="fas fa-caret-up"></i></button>
        <span class="slot-num">${unallocated ? 'Unalloc.' : ' '+(idx+1)}</span>
        <button class="order-btn" data-dir="down" data-row="${idx}" data-lock-msg="Slot ordering is locked. Ask the host to enable Override Slot Ordering."><i class="fas fa-caret-down"></i></button>
      </div>
    </td>
        <td><input class="cell-input trainee-name trainee-detail-field" placeholder="username" data-lock-msg="Trainee details are locked. Ask the host to enable Override Trainee Details."/></td>
        <td><input class="cell-input trainee-detail-field" placeholder="Discord ID" data-lock-msg="Trainee details are locked. Ask the host to enable Override Trainee Details."/></td>
        <td><input class="cell-input trainee-detail-field" placeholder="username" data-lock-msg="Trainee details are locked. Ask the host to enable Override Trainee Details."/></td>
        <td>
          <select class="cell-input trainee-detail-field" data-lock-msg="Trainee details are locked. Ask the host to enable Override Trainee Details.">
            <option>Select</option>
            ${zones.map(z=>`<option>${z}</option>`).join('')}
          </select>
        </td>
    <td>
      <div class="timer-cell">
        <span class="timer-display" data-timer="${idx}">${fmt(COUNTDOWN_START)}</span>
        <button class="timer-btn play" data-action="start" data-row="${idx}" title="Start/pause"><i class="fas fa-play"></i></button>
        <button class="timer-btn" data-action="reset" data-row="${idx}" title="Reset to 12:00"><i class="fas fa-redo"></i></button>
        <button class="timer-btn setup-done" style="width:24px" data-action="setup-done" data-row="${idx}" title="Mark setup done (stops timer)"><i class="fas fa-check"></i></button>
        <button class="timer-btn override" data-action="override" data-row="${idx}" title="Override timer value"><i class="fas fa-exclamation-triangle"></i></button>
      </div>
    </td>
    <td style="text-align:center;"><input type="checkbox" class="chk"/></td>
    <td>
      <select class="cell-input trainer-detail-field trainer-name-select" data-lock-msg="Trainer assignment is locked. Ask the host to enable Override Trainer Assignment.">
        <option value="">— None —</option>
        ${Object.keys(STAFF_DIRECTORY).map(n=>`<option value="${n}">${n}</option>`).join('')}
      </select>
    </td>
    <td><input class="cell-input trainer-detail-field trainer-discord-id" placeholder="Discord ID" readonly data-lock-msg="This fills in automatically from the trainer's staff record."/></td>
    <td style="text-align:center;">
      <button class="feedback-btn" data-row="${idx}"><i class="fas fa-comment-dots"></i> Feedback</button>
    </td>
    <td>
      <div class="announcement-cell">
        <div class="announcement-preview" data-row="${idx}"></div>
        <button type="button" class="announcement-copy-btn" data-row="${idx}" title="Copy zone announcement"><i class="fas fa-copy"></i></button>
        <button type="button" class="announcement-preview-btn" data-row="${idx}" title="Preview full announcement"><i class="fas fa-eye"></i></button>
      </div>
    </td>
    <td>
      <div class="notes-cell">
        <textarea class="cell-input trainee-notes-input" rows="1" placeholder="Notes for this trainee..."></textarea>
        <button type="button" class="notes-expand-btn" data-row="${idx}" title="View full notes"><i class="fas fa-eye"></i></button>
      </div>
    </td>
    <td style="text-align:center;">
      <button class="complete-btn" data-row="${idx}">Mark done</button>
    </td>
    <td style="text-align:center;">
      <button class="row-del-btn trainee-del-btn" data-row="${idx}" data-lock-msg="This requires the Override Trainees toggle. Ask the host to enable it." title="Requires Override Trainees"><i class="fas fa-trash"></i></button>
    </td>
  `;
  document.getElementById('trainee-rows').appendChild(tr);
  timers[idx] = { remainingSeconds: COUNTDOWN_START, running: false, syncedAt: Date.now(), totalMinutes: COUNTDOWN_START/60, setupSeconds: undefined };
  applyOverrides();
  renderAnnouncementPreview(idx);
  updateStatusLockState();
}
document.getElementById('add-trainee-btn').addEventListener('click', (e)=> {
  if(e.currentTarget.classList.contains('is-locked')) return;
  addTraineeRow(true);
});
const initialTraineeCount = parseInt(SESSION_DATA.num_slots, 10) || 10;
for(let i=0;i<initialTraineeCount;i++) addTraineeRow(false);

document.getElementById('signal-time-apply').addEventListener('click', applySignalMinutes);

/* timer controls (event delegation) */
document.getElementById('trainee-rows').addEventListener('click', (e)=>{
  const timerBtn = e.target.closest('.timer-btn');
  if(timerBtn){
    const row = timerBtn.dataset.row;
    const action = timerBtn.dataset.action;
    if(action === 'start') toggleTimer(row);
    if(action === 'reset') resetTimer(row);
    if(action === 'setup-done'){
          if(timerBtn.classList.contains('done')) return; // locked once marked — use Override Setup Time instead
          timerBtn.classList.add('done');
          recordSetupDone(row);
          syncModalSetupDoneBtn(row, true);
        }
    if(action === 'override'){
          const input = prompt('Override timer to MM:SS (e.g. 05:30):', fmt(computeCurrentRemaining(timers[row])));
          if(input !== null) setTimerValue(row, input);
        }
    return;
  }

  const completeBtn = e.target.closest('.complete-btn');
  if(completeBtn){
    const done = completeBtn.classList.toggle('done');
    completeBtn.innerHTML = done
      ? 'Done'
      : 'Mark done';
      updateStatusLockState();
    return;
  }

  const orderBtn = e.target.closest('.order-btn');
  if(orderBtn){
    if(orderBtn.classList.contains('is-locked')) return;
    const tr = orderBtn.closest('tr');
    if(orderBtn.dataset.dir === 'up' && tr.previousElementSibling){
      tr.parentNode.insertBefore(tr, tr.previousElementSibling);
    } else if(orderBtn.dataset.dir === 'down' && tr.nextElementSibling){
      tr.parentNode.insertBefore(tr.nextElementSibling, tr);
    }
    return;
  }

  const fbBtn = e.target.closest('.feedback-btn');
  if(fbBtn){
    openFeedbackModal(fbBtn);
  }

  const delBtn = e.target.closest('.trainee-del-btn');
    if(delBtn){
      if(delBtn.classList.contains('is-locked')) return;
      delete timers[delBtn.dataset.row];
      delBtn.closest('tr').remove();
      updateStatusLockState();
      queueLiveStateSync();
      return;
    }

const expandBtn = e.target.closest('.notes-expand-btn');
    if(expandBtn){
      openNotesFloat(expandBtn.dataset.row);
      return;
    }

    const announceCopyBtn = e.target.closest('.announcement-copy-btn');
    if(announceCopyBtn){
      const text = resolveAnnouncement(announceCopyBtn.dataset.row);
      navigator.clipboard.writeText(text).then(()=>{
        const original = announceCopyBtn.innerHTML;
        announceCopyBtn.classList.add('copied');
        announceCopyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(()=>{
          announceCopyBtn.classList.remove('copied');
          announceCopyBtn.innerHTML = original;
        }, 1200);
      });
      return;
    }

    const announcePreviewBtn = e.target.closest('.announcement-preview-btn');
    if(announcePreviewBtn){
      openAnnouncementFloat(announcePreviewBtn.dataset.row);
    }
});

document.getElementById('trainee-rows').addEventListener('input', (e)=>{
  if(e.target.classList.contains('trainee-name')){
    renderAnnouncementPreview(e.target.closest('tr').dataset.row);
  }
});
document.getElementById('trainee-rows').addEventListener('change', (e)=>{
  if(e.target.matches('select.trainee-detail-field')){
    renderAnnouncementPreview(e.target.closest('tr').dataset.row);
  }
});
document.getElementById('trainee-rows').addEventListener('change', (e)=>{
  if(e.target.classList.contains('trainer-name-select')){
    const idInput = e.target.closest('tr').querySelector('.trainer-discord-id');
    if(idInput) idInput.value = STAFF_DIRECTORY[e.target.value] || '';
  }
});

/* ================= HORIZONTAL WHEEL SCROLL ================= */
const scrollWrap = document.getElementById('trainee-scroll');
scrollWrap.addEventListener('wheel', (e)=>{
  // let ctrl+wheel (browser zoom) behave natively
  if(e.ctrlKey) return;
  if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
    scrollWrap.scrollLeft += e.deltaY;
    e.preventDefault();
  }
}, { passive:false });

/* ================= STAFF ROWS ================= */
const STAFF_LIMIT = 10;
const STAFF_ROLE_LOCK_MSG = 'Staff roles are locked. Ask the host to enable Allow Assistant Override Staff Roles.';
const STAFF_DEL_LOCK_MSG = 'Staff removal requires host access and Override Staff Deletion.';
const DEFAULT_STAFF_ROLE = 'Assistant';

function addStaffRow(){
  if(document.querySelectorAll('#staff-rows tr').length >= STAFF_LIMIT) return;
  const idx = staffCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="cell-input staff-role-select" data-lock-msg="${STAFF_ROLE_LOCK_MSG}">
        ${staffRoles.map(r=>`<option ${r===DEFAULT_STAFF_ROLE?'selected':''}>${r}</option>`).join('')}
      </select>
    </td>
    <td><input class="cell-input staff-username" placeholder="username"/></td>
    <td style="text-align:center;"><input type="checkbox" class="chk"/></td>
    <td><input class="cell-input" placeholder="—"/></td>
    <td style="text-align:center;"><button type="button" class="row-del-btn staff-del-btn" data-lock-msg="${STAFF_DEL_LOCK_MSG}" title="Host + Override Staff Deletion required"><i class="fas fa-trash"></i></button></td>
  `;
  document.getElementById('staff-rows').appendChild(tr);
  applyOverrides();
  updateStaffAddState();
}

function updateStaffAddState(){
  document.getElementById('add-staff-btn').disabled = document.querySelectorAll('#staff-rows tr').length >= STAFF_LIMIT;
}

document.getElementById('add-staff-btn').addEventListener('click', addStaffRow);

function applyRemoteStaff(staffArr) {
    if (!Array.isArray(staffArr)) return;
    const tbody = document.getElementById('staff-rows');
    const activeInStaff = document.activeElement && tbody.contains(document.activeElement);
    if (activeInStaff) return; // don't yank focus/values while someone's mid-edit

    tbody.innerHTML = '';
    staffCount = 0;
    if (!staffArr.length) { seedStaffFromSession(); return; }
    staffArr.forEach(s => {
        addStaffRow();
        const tr = document.querySelector('#staff-rows tr:last-child');
        if (s.role) tr.querySelector('.staff-role-select').value = s.role;
        tr.querySelector('.staff-username').value = s.discord || '';
        const notesInput = tr.querySelectorAll('.cell-input')[1];
        if (notesInput) notesInput.value = s.notes || '';
    });
    updateStaffAddState();
}

function seedStaffFromSession(){
  const seeds = [
    { name: SESSION_DATA.co_host1, role: 'Co-Host' },
    { name: SESSION_DATA.co_host2, role: 'Co-Host' },
    { name: SESSION_DATA.co_host3, role: 'Co-Host' },
    { name: SESSION_DATA['co_host4/supervisor'], role: 'Co-Host' },
    { name: SESSION_DATA.assistant_1, role: 'Assistant' },
    { name: SESSION_DATA.assistant_2, role: 'Assistant' },
    { name: SESSION_DATA.assistant_3, role: 'Assistant' },
    { name: SESSION_DATA.assistant_4, role: 'Assistant' },
  ].filter(s => s.name);

  if(!seeds.length){ addStaffRow(); addStaffRow(); addStaffRow(); return; }

  seeds.forEach(s => {
    addStaffRow();
    const tr = document.querySelector('#staff-rows tr:last-child');
    tr.querySelector('.staff-role-select').value = s.role;
    tr.querySelector('.staff-username').value = s.name; // Discord username column
  });
}
if (LIVE_STATE.staffShift && LIVE_STATE.staffShift.length) {
  applyRemoteStaff(LIVE_STATE.staffShift);
} else {
  seedStaffFromSession();
}

document.getElementById('staff-rows').addEventListener('click', (e)=>{
  const delBtn = e.target.closest('.staff-del-btn');
  if(delBtn){
    if(delBtn.classList.contains('is-locked')) return;
    delBtn.closest('tr').remove();
    updateStaffAddState();
    queueLiveStateSync();
  }
});

// Only one "Main AST" allowed at a time — assigning it to a row bumps whoever had it down to Assistant.
document.getElementById('staff-rows').addEventListener('change', (e)=>{
  const select = e.target.closest('.staff-role-select');
  if(!select) return;
  if(select.value === 'Main AST'){
    document.querySelectorAll('#staff-rows .staff-role-select').forEach(other=>{
      if(other !== select && other.value === 'Main AST'){
        other.value = 'Assistant';
        showToast('Main AST reassigned — the previous Main AST was moved to Assistant.');
      }
    });
  }
});

/* ================= DRIVER ROWS ================= */
const DRIVER_LOCK_MSG = 'Driver input has been disabled by the host.';
function addDriverRow(){
  const idx = driverCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="cell-input driver-field" placeholder="username" data-lock-msg="${DRIVER_LOCK_MSG}"/></td>
    <td><input class="cell-input driver-field" placeholder="username" data-lock-msg="${DRIVER_LOCK_MSG}"/></td>
    <td style="text-align:center;"><input type="checkbox" class="chk driver-field" data-lock-msg="${DRIVER_LOCK_MSG}"/></td>
    <td style="text-align:center;"><button type="button" class="row-del-btn driver-del-btn" title="Remove driver"><i class="fas fa-trash"></i></button></td>
  `;
  document.getElementById('driver-rows').appendChild(tr);
  applyOverrides();
}

function applyRemoteDrivers(driversArr) {
    if (!Array.isArray(driversArr)) return;
    const tbody = document.getElementById('driver-rows');
    const activeInDrivers = document.activeElement && tbody.contains(document.activeElement);
    if (activeInDrivers) return; // don't yank focus/values while someone's mid-edit

    tbody.innerHTML = '';
    driverCount = 0;
    const rows = driversArr.length ? driversArr : [{discord:'',roblox:'',attended:false},{discord:'',roblox:'',attended:false},{discord:'',roblox:'',attended:false}];
    rows.forEach(d => {
        addDriverRow();
        const tr = document.querySelector('#driver-rows tr:last-child');
        const inputs = tr.querySelectorAll('.driver-field');
        inputs[0].value = d.discord || '';
        inputs[1].value = d.roblox || '';
        inputs[2].checked = !!d.attended;
    });
}
document.getElementById('add-driver-btn').addEventListener('click', addDriverRow);
applyRemoteDrivers(LIVE_STATE.drivers);

document.getElementById('driver-rows').addEventListener('click', (e)=>{
  const delBtn = e.target.closest('.driver-del-btn');
  if(delBtn){
    delBtn.closest('tr').remove();
    queueLiveStateSync();
  }
});

/* ================= FEEDBACK MODAL ================= */
const feedbackModal = document.getElementById('feedback-modal');

/* ================= SCRIPT (signalling briefing) — read-only, copy per line ================= */
const SCRIPT_LINES = [
  "@[NAME] It is your turn to signal. Please check your DMs",
  "Hello, it is time for you to signal. Please spawn as an *SG* at **[LOCATION]** and line up in front of me.",
  "Before we start if you wish to receive feedback on your performance, please let me know now. (Wait for trainee to arrive)",
  "Here are some general reminders before we begin: You have XX minutes to signal. The timer begins once you sit down on the desk.",
  "While you are setting up, be aware of trains running on the line. *DO NOT* cause an adverse signal (changing signal in front of a train).",
  "You are timed during your setup. However, as mentioned earlier, it is recommended to limit your setup time to around 2 minutes.",
  "Do you have any signalling related questions before we proceed? If not, please do say so. (Wait for question)",
  "If you have no further questions, you may sit on the desk whenever you’re ready. Make sure to pay attention to your DM’s at *ALL* times. (No questions)",
  "Times is up. Please hop off the desk! (End of trainees' time)"
];

function escapeForPreview(text){
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\[([^\]]+)\]/g, '<span class="placeholder-tag">[$1]</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function formatSessionDateTime(){
  const dateInput = document.getElementById('session-date-input');
  const timeInput = document.getElementById('session-time-input');
  let datePart = '__/__/____';
  if(dateInput && dateInput.value){
    const [y, m, d] = dateInput.value.split('-');
    datePart = `${d}/${m}/${y}`;
  }
  let timePart = '--:--';
  if(timeInput && timeInput.value){
    timePart = timeInput.value; // native time input already gives 24h "HH:MM"
  }
  return `${datePart} | ${timePart} BST`;
}

function buildFeedbackMessage(){
  const row = activeFeedbackRow;
  const rowEl = row !== null ? document.querySelector(`tr[data-row="${row}"]`) : null;
  const trainerFields = rowEl ? rowEl.querySelectorAll('.trainer-detail-field') : [];
  const trainerName = trainerFields[0] ? trainerFields[0].value.trim() : '';
  const zoneSelect = rowEl ? rowEl.querySelector('td:nth-child(5) select') : null;
  const zoneVal = (zoneSelect && zoneSelect.value && zoneSelect.value !== 'Select') ? zoneSelect.value : '';
  const trainsVal = document.getElementById('fb-trains')?.value.trim() || '';
  const setupTimeVal = document.getElementById('fb-setup-time')?.value.trim() || '';

  const getFb = (field) => document.querySelector(`.feedback-text[data-field="${field}"]`)?.value.trim() || '';

  return `# Practice Feedback
**Trainer**: ${trainerName}
**Date of session**: ${formatSessionDateTime()}
**Zone**: ${zoneVal}
**Trains signalled**: ${trainsVal}
**Set-up time**: ${setupTimeVal}

=========================

__**Zone Setup**__
${getFb('setup')}

__**Conflict Handling**__
${getFb('conflict')}

__**Priority Handling**__
${getFb('priority')}

__**Rollbacks and Delay**__
${getFb('rbtiming')}

__**Overall**__
${getFb('overall')}

__*Notes/Advice*__
${getFb('notes')}

If you believe you were unfairly assessed or have any additional questions, feel free to ask!
Thank you for attending.`;
}

function renderScriptPreview(minutes){
  const displayMinutes = minutes || Math.round(COUNTDOWN_START/60);
  const container = document.getElementById('script-preview');
  container.innerHTML = '';
  SCRIPT_LINES.forEach(

    lineText=>{
    const resolvedText = lineText.replace(/XX/g, displayMinutes);
    const line = document.createElement('div');
    line.className = 'script-line';
    const textEl = document.createElement('div');
    textEl.className = 'script-line-text';
    textEl.innerHTML = escapeForPreview(resolvedText);
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'script-copy-btn';
    copyBtn.title = 'Copy this line';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.addEventListener('click', ()=>{
      navigator.clipboard.writeText(resolvedText).then(()=>{
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(()=>{
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 1200);
      });
    });
    line.appendChild(textEl);
    line.appendChild(copyBtn);
    container.appendChild(line);
  });
}
renderScriptPreview();

/* ================= ZONE ANNOUNCEMENTS (copy-paste, references Zone column) ================= */
function resolveAnnouncement(row){
  const rowEl = document.querySelector(`tr[data-row="${row}"]`);
  if(!rowEl) return ANNOUNCEMENT_TEMPLATE;
  const nameInput = rowEl.querySelector('.trainee-name');
  const zoneSelect = rowEl.querySelector('select.trainee-detail-field');
  const traineeName = (nameInput && nameInput.value.trim()) || '[TRAINEE]';
  const zoneVal = (zoneSelect && zoneSelect.value && zoneSelect.value !== 'Select') ? zoneSelect.value : '[ZONE]';
  return ANNOUNCEMENT_TEMPLATE.replaceAll('[TRAINEE]', traineeName).replaceAll('[ZONE]', zoneVal);
}

function formatAnnouncementLine(line){
  if(/^_{2,}$/.test(line.trim())) return '<hr class="announcement-hr"/>';
  const h2Match = line.match(/^##\s+(.*)$/);
  const h1Match = line.match(/^#\s+(.*)$/);
  if(h2Match) return `<div class="announcement-h2">${escapeForPreview(h2Match[1])}</div>`;
  if(h1Match) return `<div class="announcement-h1">${escapeForPreview(h1Match[1])}</div>`;
  return `<div class="announcement-line-text">${escapeForPreview(line)}</div>`;
}

function renderAnnouncementPreview(row){
  const previewEl = document.querySelector(`.announcement-preview[data-row="${row}"]`);
  if(!previewEl) return;
  previewEl.innerHTML = resolveAnnouncement(row).split('\n').map(formatAnnouncementLine).join('');
}

let activeFeedbackBtn = null;
let activeFeedbackRow = null;

const feedbackData = {}; // row -> { trains, setup, conflict, priority, rbtiming, overall, notes }
function getFeedbackData(row){
  if(!feedbackData[row]) feedbackData[row] = { trains:'', setup:'', conflict:'', priority:'', rbtiming:'', overall:'', notes:'' };
  return feedbackData[row];
}
function openFeedbackModal(triggerBtn){
  feedbackModal.classList.remove('closing');
  activeFeedbackBtn = triggerBtn;
  const row = triggerBtn.dataset.row;
  activeFeedbackRow = row;

  const rowEl = document.querySelector(`tr[data-row="${row}"]`);
  const nameInput = rowEl.querySelector('.trainee-name');
  const zoneSelect = rowEl.querySelector('td:nth-child(5) select');

  document.getElementById('fb-trainee-name').value = nameInput ? nameInput.value : '';
  document.getElementById('fb-zone').value = zoneSelect ? zoneSelect.value : 'Select';
  document.getElementById('fb-date').value = new Date().toISOString().slice(0,10);

  const t = timers[row];
  document.getElementById('fb-timer-display').textContent = fmt(computeCurrentRemaining(t));
  syncModalPlayBtn(row, t.running);

  document.getElementById('fb-setup-time').value = t.setupSeconds !== undefined ? fmt(t.setupSeconds) : '';
  const rowSetupBtn = document.querySelector(`.timer-btn.setup-done[data-row="${row}"]`);
  document.getElementById('fb-setup-done').classList.toggle('done', !!(rowSetupBtn && rowSetupBtn.classList.contains('done')));
  renderScriptPreview(t.totalMinutes);

  const savedFb = getFeedbackData(row);
  document.getElementById('fb-trains').value = savedFb.trains;
  document.querySelectorAll('.feedback-text').forEach(ta=>{
    ta.value = savedFb[ta.dataset.field] || '';
  });

  feedbackModal.classList.add('open');
}

document.getElementById('fb-trains').addEventListener('input', (e)=>{
  if(activeFeedbackRow === null) return;
  getFeedbackData(activeFeedbackRow).trains = e.target.value;
  queueLiveStateSync();
});
document.querySelectorAll('.feedback-text').forEach(ta=>{
  ta.addEventListener('input', ()=>{
    if(activeFeedbackRow === null) return;
    getFeedbackData(activeFeedbackRow)[ta.dataset.field] = ta.value;
    queueLiveStateSync();
  });
});

function closeFeedbackModal(){
  feedbackModal.classList.add('closing');
  feedbackModal.classList.remove('open');
  setTimeout(()=>{
    feedbackModal.classList.remove('closing');
  }, 250);
  activeFeedbackBtn = null;
  activeFeedbackRow = null;
}

document.getElementById('fb-timer-toggle').addEventListener('click', ()=>{
  if(activeFeedbackRow !== null) toggleTimer(activeFeedbackRow);
});
document.getElementById('fb-timer-reset').addEventListener('click', ()=>{
  if(activeFeedbackRow !== null) resetTimer(activeFeedbackRow);
});
document.getElementById('fb-timer-override').addEventListener('click', ()=>{
  if(activeFeedbackRow === null) return;
  const input = prompt('Set timer to MM:SS (e.g. 05:30):', fmt(computeCurrentRemaining(timers[activeFeedbackRow])));
  if(input !== null) setTimerValue(activeFeedbackRow, input);
});
document.getElementById('fb-setup-done').addEventListener('click', ()=>{
  if(activeFeedbackRow === null) return;
  const row = activeFeedbackRow;
  const modalBtn = document.getElementById('fb-setup-done');
  if(modalBtn.classList.contains('done')) return; // locked once marked — use Override Setup Time instead
  modalBtn.classList.add('done');
  recordSetupDone(row);
  const rowBtn = document.querySelector(`.timer-btn.setup-done[data-row="${row}"]`);
  if(rowBtn) rowBtn.classList.add('done');
});

document.getElementById('fb-setup-override').addEventListener('click', ()=>{
  if(activeFeedbackRow !== null) overrideSetupTime(activeFeedbackRow);
});

document.getElementById('copy-feedback-btn').addEventListener('click', ()=>{
  const btn = document.getElementById('copy-feedback-btn');
  navigator.clipboard.writeText(buildFeedbackMessage()).then(()=>{
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    showToast('Feedback message copied.');
    setTimeout(()=>{
      btn.classList.remove('copied');
      btn.innerHTML = '<i class="fas fa-copy"></i>';
    }, 1200);
  });
});

// Modal fields that are permanently read-only mirrors — clicking them explains where to actually edit.
document.querySelectorAll('#feedback-modal [data-lock-msg]').forEach(el=>{
  el.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    showToast(el.dataset.lockMsg);
  });
});

document.getElementById('modal-close').addEventListener('click', closeFeedbackModal);
document.getElementById('fb-cancel').addEventListener('click', closeFeedbackModal);
feedbackModal.addEventListener('click', (e)=>{ if(e.target === feedbackModal) closeFeedbackModal(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeFeedbackModal(); });

document.getElementById('fb-save').addEventListener('click', ()=>{
  if(activeFeedbackBtn){
    activeFeedbackBtn.classList.add('filled');
    activeFeedbackBtn.classList.remove('requested');
    activeFeedbackBtn.innerHTML = '<i class="fas fa-comment-check"></i> Feedback saved';
  }
  closeFeedbackModal();
  // TODO: POST feedback fields to save_feedback.php keyed by trainee row/session
});

/* ================= FLOATING NOTES VIEWER ================= */
let notesFloatRow = null;
const notesFloat = document.getElementById('notes-float');
const notesFloatTextarea = document.getElementById('notes-float-textarea');

function openNotesFloat(row){
  notesFloatRow = row;
  const rowTextarea = document.querySelector(`tr[data-row="${row}"] .trainee-notes-input`);
  notesFloatTextarea.value = rowTextarea ? rowTextarea.value : '';
  notesFloat.style.display = 'flex';
}

notesFloatTextarea.addEventListener('input', ()=>{
  if(notesFloatRow === null) return;
  const rowTextarea = document.querySelector(`tr[data-row="${notesFloatRow}"] .trainee-notes-input`);
  if(rowTextarea) rowTextarea.value = notesFloatTextarea.value;
});

document.getElementById('notes-float-close').addEventListener('click', ()=>{
  notesFloat.style.display = 'none';
  notesFloatRow = null;
});

(function enableNotesFloatDrag(){
  const header = document.getElementById('notes-float-header');
  let dragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener('mousedown', (e)=>{
    dragging = true;
    const rect = notesFloat.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });
  document.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    notesFloat.style.left = (e.clientX - offsetX) + 'px';
    notesFloat.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', ()=>{ dragging = false; });
})();

/* ================= FLOATING ANNOUNCEMENT PREVIEW (read-only) ================= */
const announcementFloat = document.getElementById('announcement-float');
const announcementFloatPreview = document.getElementById('announcement-float-preview');

function openAnnouncementFloat(row){
  announcementFloatPreview.innerHTML = resolveAnnouncement(row).split('\n').map(formatAnnouncementLine).join('');
  announcementFloat.style.display = 'flex';
}

document.getElementById('announcement-float-close').addEventListener('click', ()=>{
  announcementFloat.style.display = 'none';
});

(function enableAnnouncementFloatDrag(){
  const header = document.getElementById('announcement-float-header');
  let dragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener('mousedown', (e)=>{
    dragging = true;
    const rect = announcementFloat.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });
  document.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    announcementFloat.style.left = (e.clientX - offsetX) + 'px';
    announcementFloat.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', ()=>{ dragging = false; });
})();

/* ================= INIT ================= */
applyOverrides();

function fmtHMS(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/* ================= GLOBAL TRAINEE TIMER (overall session clock) ================= */
const sessionStartMs = SESSION_STARTED_AT ? new Date(SESSION_STARTED_AT.replace(' ', 'T') + 'Z').getTime() : Date.now();
setInterval(()=>{
  const elapsed = Math.max(0, Math.floor((Date.now() - sessionStartMs) / 1000));
  const el = document.getElementById('global-timer-display');
  if(el) el.textContent = fmtHMS(elapsed);
}, 1000);

/* real sync indicator — only resets after an actual successful round-trip */
let lastSuccessfulSyncAt = Date.now();
setInterval(()=>{
  const secondsAgo = Math.floor((Date.now() - lastSuccessfulSyncAt) / 1000);
  const el = document.getElementById('sync-note');
  if (el) el.textContent = `synced ${secondsAgo}s ago`;
}, 1000);

/* ================= BELL SYSTEM ================= */
/* ================= BELL SYSTEM (LOCAL SIMULATION — testing only, no server calls yet) ================= */
const BELL_BUTTON_COOLDOWN_MS = 7000;
const BELL_GLOBAL_COOLDOWN_MS = 5 * 60 * 1000;
const BELL_MAX_INITIATIONS = 3;

const bellWidget = document.getElementById('bell-widget');
const bellFab = document.getElementById('bell-fab');
const bellFabDot = document.getElementById('bell-fab-dot');
const bellPanel = document.getElementById('bell-panel');

document.getElementById('bell-panel-close').addEventListener('click', ()=> bellPanel.classList.remove('open'));
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#bell-widget')) bellPanel.classList.remove('open');
});

(function enableBellDrag(){
  let dragging = false, moved = false, offsetX = 0, offsetY = 0;
  bellFab.addEventListener('mousedown', (e)=>{
    dragging = true;
    moved = false;
    const rect = bellWidget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault(); // stop text-selection while dragging
  });
  document.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    moved = true;
    const maxLeft = window.innerWidth - bellFab.offsetWidth;
    const maxTop = window.innerHeight - bellFab.offsetHeight;
    bellWidget.style.left = Math.min(Math.max(0, e.clientX - offsetX), maxLeft) + 'px';
    bellWidget.style.top = Math.min(Math.max(0, e.clientY - offsetY), maxTop) + 'px';
    bellWidget.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', ()=>{
    if(dragging && !moved) bellPanel.classList.toggle('open');
    dragging = false;
  });
})();

const bellButtons = {
  host: document.getElementById('bell-host'),
  cohost: document.getElementById('bell-cohost'),
  assistant: document.getElementById('bell-assistant'),
};
const bellCooldownFills = {
  host: document.getElementById('bell-host-cooldown'),
  cohost: document.getElementById('bell-cohost-cooldown'),
  assistant: document.getElementById('bell-assistant-cooldown'),
};
const bellSounds = {
  hostRing: document.getElementById('sound-host-bell'),
  cohostAck: document.getElementById('sound-cohost-ack'),
  assistantAck: document.getElementById('sound-assistant-ack'),
};

let bellState = {
  active: false,
  initiatorRole: null,
  acks: { host:false, cohost:false, assistant:false },
  globalCooldownUntil: 0,
  initiationCount: 0,
};
const sessionHasCohost = !!(SESSION_DATA.co_host1 || SESSION_DATA.co_host2 || SESSION_DATA.co_host3 || SESSION_DATA['co_host4/supervisor']);
const sessionHasAssistant = !!(SESSION_DATA.assistant_1 || SESSION_DATA.assistant_2 || SESSION_DATA.assistant_3 || SESSION_DATA.assistant_4);
const localButtonCooldownUntil = { host:0, cohost:0, assistant:0 };

function renderBellState(){
  const now = Date.now();
  const globalCooldownActive = bellState.globalCooldownUntil > now;

  ['host','cohost','assistant'].forEach(role=>{
    const btn = bellButtons[role];
    btn.classList.remove('awaiting-ack','acked');
    if(bellState.active){
      if(role !== bellState.initiatorRole && !bellState.acks[role]) btn.classList.add('awaiting-ack');
      if(bellState.acks[role]) btn.classList.add('acked');
    }
  });
    
  bellButtons.host.disabled = globalCooldownActive || localButtonCooldownUntil.host > now ||
    (bellState.active
      ? (bellState.initiatorRole === 'host' || bellState.acks.host)
      : bellState.initiationCount >= BELL_MAX_INITIATIONS);
  bellButtons.cohost.disabled = globalCooldownActive || localButtonCooldownUntil.cohost > now ||
    (bellState.active
      ? (bellState.initiatorRole === 'cohost' || bellState.acks.cohost)
      : bellState.initiationCount >= BELL_MAX_INITIATIONS);
  bellButtons.assistant.disabled = globalCooldownActive || localButtonCooldownUntil.assistant > now ||
    (bellState.active ? bellState.acks.assistant : true);
  bellFabDot.classList.toggle('show', bellState.active);
  if(!sessionHasCohost) bellButtons.cohost.disabled = true;
  if(!sessionHasAssistant) bellButtons.assistant.disabled = true;
}

function armButtonCooldown(role){
  localButtonCooldownUntil[role] = Date.now() + BELL_BUTTON_COOLDOWN_MS;
  const fill = bellCooldownFills[role];
  if(fill){
    fill.style.animation = 'none';
    void fill.offsetWidth;
    fill.style.animation = `bellCooldown ${BELL_BUTTON_COOLDOWN_MS}ms linear forwards`;
  }
  setTimeout(renderBellState, BELL_BUTTON_COOLDOWN_MS + 50);
}

function checkAllAcked(){
  return ['host','cohost','assistant'].filter(r => r !== bellState.initiatorRole).every(r => {
    if(r === 'cohost' && !sessionHasCohost) return true;
    if(r === 'assistant' && !sessionHasAssistant) return true;
    return bellState.acks[r];
  });
}
function endCycleWithCooldown(){
  bellState.active = false;
  bellState.globalCooldownUntil = Date.now() + BELL_GLOBAL_COOLDOWN_MS;
  renderBellState();
  showToast('All acknowledged — bell system entering 5 minute cooldown.');
  setTimeout(()=>{
    bellState = { active:false, initiatorRole:null, acks:{host:false,cohost:false,assistant:false}, globalCooldownUntil:0, initiationCount:0 };
    renderBellState();
    showToast('Bell system reset and ready.');
  }, BELL_GLOBAL_COOLDOWN_MS);
}

function ringBell(role){
  if(bellState.active){ showToast('A bell is already active.'); return; }
  if(bellState.globalCooldownUntil > Date.now()){ showToast('Bell system is cooling down.'); return; }
  if(bellState.initiationCount >= BELL_MAX_INITIATIONS){ showToast('You have reached the bell limit until the next reset.'); return; }
  bellState.active = true;
  bellState.initiatorRole = role;
  bellState.acks = { host:false, cohost:false, assistant:false };
  bellState.acks[role] = true;
  bellState.initiationCount++;
  renderBellState();
  bellSounds.hostRing.currentTime = 0; bellSounds.hostRing.play().catch(()=>{});
  armButtonCooldown(role);
}

function ackBell(role){
  if(!bellState.active){ showToast('No active bell to acknowledge.'); return; }
  if(role === bellState.initiatorRole){ showToast('Invalid acknowledgment.'); return; }
  bellState.acks[role] = true;
  const snd = role === 'cohost' ? bellSounds.cohostAck : bellSounds.assistantAck;
  snd.currentTime = 0; snd.play().catch(()=>{});
  renderBellState();
  armButtonCooldown(role);
  if(checkAllAcked()) endCycleWithCooldown();
}

// Local test mode: click a button to ring it (if idle) or ack it (if a bell is active) — lets you test the whole flow solo, on one page.
bellButtons.host.addEventListener('click', ()=>{
  if(bellButtons.host.disabled) return;
  bellState.active ? ackBell('host') : ringBell('host');
});
bellButtons.cohost.addEventListener('click', ()=>{
  if(bellButtons.cohost.disabled) return;
  bellState.active ? ackBell('cohost') : ringBell('cohost');
});
bellButtons.assistant.addEventListener('click', ()=>{
  if(bellButtons.assistant.disabled) return;
  if(!bellState.active){ showToast('Assistants can only acknowledge an active bell — ring Host or Co-host first to test.'); return; }
  ackBell('assistant');
});

renderBellState();

/* ================= RESIZABLE COLUMNS ================= */
function makeColumnsResizable(table){
  table.classList.add('resizable-cols');
  table.querySelectorAll('thead th').forEach(th=>{
    if(th.querySelector('.col-resizer')) return;
    const handle = document.createElement('span');
    handle.className = 'col-resizer';
    th.appendChild(handle);
    handle.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      handle.classList.add('resizing');
      function onMove(ev){ th.style.width = Math.max(50, startWidth + (ev.pageX - startX)) + 'px'; }
      function onUp(){
        handle.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}
document.querySelector('#trainee-scroll table') && makeColumnsResizable(document.querySelector('#trainee-scroll table'));
document.querySelectorAll('.drivers-table, .staff-table').forEach(makeColumnsResizableContained);

function makeColumnsResizableContained(table){
  table.classList.add('resizable-cols');
  table.querySelectorAll('thead th').forEach(th=>{
    if(th.querySelector('.col-resizer')) return;
    const handle = document.createElement('span');
    handle.className = 'col-resizer';
    th.appendChild(handle);
    handle.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      handle.classList.add('resizing');
      const wrapper = table.closest('.table-wrap');
      function onMove(ev){
        const containerWidth = wrapper.clientWidth;
        const otherThs = Array.from(table.querySelectorAll('thead th')).filter(o => o !== th);
        const othersWidth = otherThs.reduce((sum, o) => sum + o.offsetWidth, 0);
        const maxWidth = containerWidth - othersWidth - 2; // small buffer so borders don't tip it over
        const requested = startWidth + (ev.pageX - startX);
        th.style.width = Math.max(50, Math.min(requested, maxWidth)) + 'px';
      }
      function onUp(){
        handle.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

/* ================= COLUMN VISIBILITY (Trainees panel only) ================= */
const TRAINEE_COLUMNS = [
  {n:1, label:'Slot'},
  {n:2, label:'Trainee Discord'},
  {n:3, label:'Discord ID'},
  {n:4, label:'Roblox'},
  {n:5, label:'Zone'},
  {n:6, label:'Timer'},
  {n:7, label:'Attendance'},
  {n:8, label:'Trainer'},
  {n:9, label:'Trainer Discord ID'},
  {n:10, label:'Feedback'},
  {n:11, label:'Announcements'},
  {n:12, label:'Trainee Notes'},
  {n:13, label:'Completed'},
  {n:14, label:'Remove'},
];
const EXTRA_COLUMNS = [1,3,7,9,12,14];
const traineeTable = document.querySelector('#trainee-scroll table');
const colPickerMenu = document.getElementById('col-picker-menu');

function setColumnVisible(n, visible){
  traineeTable.classList.toggle(`col-hide-${n}`, !visible);
  const cb = colPickerMenu.querySelector(`input[data-col="${n}"]`);
  if(cb) cb.checked = visible;
}

function resetColumnWidths(){
  traineeTable.querySelectorAll('thead th').forEach(th=>{ th.style.width = ''; });
}

TRAINEE_COLUMNS.forEach(col=>{
  const row = document.createElement('label');
  row.className = 'col-picker-row';
  row.innerHTML = `<input type="checkbox" data-col="${col.n}" checked/> ${col.label}`;
  colPickerMenu.appendChild(row);
});
colPickerMenu.addEventListener('change', (e)=>{
  const cb = e.target.closest('input[data-col]');
  if(cb) setColumnVisible(parseInt(cb.dataset.col,10), cb.checked);
});

document.getElementById('col-picker-toggle').addEventListener('click', (e)=>{
  e.stopPropagation();
  colPickerMenu.classList.toggle('open');
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('.col-picker-wrap')) colPickerMenu.classList.remove('open');
});

document.getElementById('hide-extras-btn').addEventListener('click', ()=>{
  EXTRA_COLUMNS.forEach(n=> setColumnVisible(n, false));
  resetColumnWidths();
});
document.getElementById('show-all-cols-btn').addEventListener('click', ()=>{
  TRAINEE_COLUMNS.forEach(col=> setColumnVisible(col.n, true));
  resetColumnWidths();
});
/* ================= CONCLUDE SESSION ================= */
function updateConcludeButtonState(){
  const btn = document.getElementById('conclude-session-btn');
  if(!btn) return;
  const status = document.getElementById('status-select').value;
  const unlocked = isHost && (status === 'cancelled' || status === 'concluded');
  setLocked(btn, !unlocked);
}

document.getElementById('status-select').addEventListener('change', updateConcludeButtonState);
updateConcludeButtonState();

document.getElementById('conclude-session-btn').addEventListener('click', async (e)=>{
  if(e.currentTarget.classList.contains('is-locked')) return;
  const incompleteRows = Array.from(document.querySelectorAll('#trainee-rows tr'))
    .filter(tr => !tr.querySelector('.complete-btn')?.classList.contains('done'))
    .map(tr => {
      const slotLabel = tr.querySelector('.slot-num')?.textContent.trim() || `Row ${tr.dataset.row}`;
      return `Trainee ${slotLabel} — not yet marked done`;
    });

  let html = `<p>You're about to conclude this session. This finalizes the session record — the status will be set to <strong>Concluded</strong> and it can no longer be edited as an active session.</p>
    <div class="conclude-warning-note"><i class="fas fa-triangle-exclamation"></i> If the session status is currently <strong>Cancelled</strong>, concluding it will record the session as cancelled-and-concluded — make sure that's actually intended before continuing, as this will be permanently recorded in the database.</div>`;

  if(incompleteRows.length){
    html += `<div class="conclude-warning-note"><i class="fas fa-triangle-exclamation"></i> ${incompleteRows.length} trainee(s) have not been marked done yet:</div>
      <ul class="conclude-warning-list">${incompleteRows.map(r=>`<li>${r}</li>`).join('')}</ul>`;
  }

  const ok = await showConfirm(html, 'Conclude this session?', true);
  if(!ok) return;

  const result = await fetch('conclude_session.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: SESSION_DATA.session_id }),
  }).then(r => r.json());

  if(!result.success){
    showToast('Failed to conclude: ' + (result.message || 'Unknown error'));
    return;
  }
  showToast('Session concluded and archived. Redirecting everyone shortly...');
  setTimeout(()=>{ window.location.href = '../dashboard/dashboard.php'; }, 2000);
});

/* ================= POLLING SYNC (session_ongoing) ================= */
const SYNC_INTERVAL_MS = 5000;
let syncInFlight = false;
let pendingLiveStateFlush = false;

function queueLiveStateSync() { pendingLiveStateFlush = true; }

function isEditingField(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// Core columns: real DB fields, safe to push straight through
function collectCoreUpdates() {
    const updates = {};
    updates.session_status = document.getElementById('status-select').value;

    let staffAttendance = '';
    document.querySelectorAll('#staff-rows .chk').forEach(cb => { staffAttendance += cb.checked ? '1' : '0'; });
    if (staffAttendance) updates.staff_attendance = staffAttendance;

    const traineeAttendanceParts = [];
    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        const chk = tr.querySelector('td:nth-child(7) .chk');
        traineeAttendanceParts.push(chk && chk.checked ? '1' : '0');
    });
    if (traineeAttendanceParts.length) updates.trainee_attendance = traineeAttendanceParts.join(',');

    // Persist staff rows into their real DB columns, by role
    const cohostCols = ['co_host1', 'co_host2', 'co_host3', 'co_host4/supervisor'];
    const assistantCols = ['assistant_1', 'assistant_2', 'assistant_3', 'assistant_4'];
    let cohostIdx = 0, assistantIdx = 0;
    document.querySelectorAll('#staff-rows tr').forEach(tr => {
        const role = tr.querySelector('.staff-role-select')?.value;
        const discord = tr.querySelector('.cell-input:not(select)')?.value.trim();
        if (!discord) return;
        if ((role === 'Co-Host' || role === 'Main AST') && cohostIdx < cohostCols.length) {
            updates[cohostCols[cohostIdx++]] = discord;
        } else if (assistantIdx < assistantCols.length) {
            updates[assistantCols[assistantIdx++]] = discord;
        }
    });

    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        const row = tr.dataset.row;
        const idx = parseInt(row, 10) + 1; // DB columns are 1-indexed
        const nameEl = tr.querySelector('.trainee-name');
        const detailFields = tr.querySelectorAll('.trainee-detail-field');
        const trainerFields = tr.querySelectorAll('.trainer-detail-field');
        if (nameEl) updates[`trainee_${idx}_name`] = nameEl.value.trim();
        if (detailFields[1]) updates[`trainee_${idx}_discord_id`] = detailFields[1].value.trim();
        if (detailFields[2]) updates[`trainee_${idx}_name`] = detailFields[2].value.trim(); // roblox
        if (detailFields[0]) updates[`trainee_${idx}_discord`] = detailFields[0].value.trim();
        const zoneSelect = tr.querySelector('select.trainee-detail-field');
        if (zoneSelect) updates[`trainee_${idx}_zone`] = zoneSelect.value !== 'Select' ? zoneSelect.value : null;
        const notesArea = tr.querySelector('.trainee-notes-input');
        if (notesArea) updates[`trainee_${idx}_note`] = notesArea.value.trim();
        if (trainerFields[0]) updates[`trainee_${idx}_trainer_name`] = trainerFields[0].value.trim();
    });

    return updates;
}

// Everything without a real DB column: timers, bell state, driver rows, staff-shift rows, feedback drafts
function collectLiveState() {
    const timerState = {};
    Object.keys(timers).forEach(row => {
        const t = timers[row];
        timerState[row] = {
            remainingSeconds: t.remainingSeconds,
            running: t.running,
            syncedAt: t.syncedAt,
            setupSeconds: t.setupSeconds,
        };
    });

    const drivers = Array.from(document.querySelectorAll('#driver-rows tr')).map(tr => {
        const inputs = tr.querySelectorAll('.driver-field');
        return { discord: inputs[0]?.value.trim() || '', roblox: inputs[1]?.value.trim() || '', attended: inputs[2]?.checked || false };
    });

    const staffShift = Array.from(document.querySelectorAll('#staff-rows tr')).map(tr => {
        const role = tr.querySelector('.staff-role-select')?.value || '';
        const discord = tr.querySelector('.cell-input:not(select)')?.value.trim() || '';
        const notesInput = tr.querySelectorAll('.cell-input')[1]?.value.trim() || '';
        return { role, discord, notes: notesInput };
    });

    return {
        timers: timerState,
        bellState: bellState,
        drivers: drivers,
        staffShift: staffShift,
        feedbackData: feedbackData,
        overrides: overrides,
    };
}

async function pushState() {
    if (!pendingLiveStateFlush) return;
    pendingLiveStateFlush = false;
    try {
        await fetch('sync_session.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: SESSION_DATA.session_id,
                updates: collectCoreUpdates(),
                live_state: collectLiveState(),
            }),
        });
    } catch (err) {
        console.error('Sync push failed:', err);
    }
}

function applyRemoteTimers(remoteTimers) {
    if (!remoteTimers) return;
    Object.keys(remoteTimers).forEach(row => {
        if (!timers[row]) return;
        const remote = remoteTimers[row];
        // Only adopt remote timer state if it's actually newer/different — a running
        // timer's syncedAt keeps moving forward locally each tick via display only,
        // not via mutation, so comparing raw values here is safe.
        timers[row].remainingSeconds = remote.remainingSeconds;
        timers[row].running = remote.running;
        timers[row].syncedAt = remote.syncedAt;
        timers[row].setupSeconds = remote.setupSeconds;
        updateTimerDisplay(row);
        const rowPlayBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
        if (rowPlayBtn) {
            rowPlayBtn.innerHTML = remote.running ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
            rowPlayBtn.classList.toggle('active', remote.running);
        }
    });
}

function applyRemoteState(session, liveState) {
    const active = document.activeElement;

    if (!isEditingField(active) || active.id !== 'status-select') {
        const statusSelect = document.getElementById('status-select');
        if (statusSelect.value !== session.session_status) {
            statusSelect.value = session.session_status;
            statusSelect.dispatchEvent(new Event('change'));
        }
    }
    if(session.session_status === 'concluded' && myRole !== 'host'){
    showToast('The host has concluded this session. Returning to dashboard...');
    setTimeout(()=>{ window.location.href = '../dashboard/dashboard.php'; }, 2500);
  }

    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        const idx = parseInt(tr.dataset.row, 10) + 1;
        const nameEl = tr.querySelector('.trainee-name');
        const detailFields = tr.querySelectorAll('.trainee-detail-field');
        const trainerFields = tr.querySelectorAll('.trainer-detail-field');
        const notesArea = tr.querySelector('.trainee-notes-input');

        if (nameEl && active !== nameEl) nameEl.value = session[`trainee_${idx}_name`] || '';
        if (detailFields[0] && active !== detailFields[0]) detailFields[0].value = session[`trainee_${idx}_discord`] || '';
        if (detailFields[1] && active !== detailFields[1]) detailFields[1].value = session[`trainee_${idx}_discord_id`] || '';
        const zoneSelect = tr.querySelector('select.trainee-detail-field');
        if (zoneSelect && active !== zoneSelect && session[`trainee_${idx}_zone`]) zoneSelect.value = 'Zone ' + session[`trainee_${idx}_zone`];
        if (notesArea && active !== notesArea) notesArea.value = session[`trainee_${idx}_note`] || '';
        if (trainerFields[0] && active !== trainerFields[0]) {
            trainerFields[0].value = session[`trainee_${idx}_trainer_name`] || '';
            if (trainerFields[1]) trainerFields[1].value = STAFF_DIRECTORY[trainerFields[0].value] || '';
        }

        renderAnnouncementPreview(tr.dataset.row);
    });

    if (liveState.timers) applyRemoteTimers(liveState.timers);
    if (liveState.drivers) applyRemoteDrivers(liveState.drivers);
    if (liveState.staffShift) applyRemoteStaff(liveState.staffShift);
    if (liveState.feedbackData) Object.assign(feedbackData, liveState.feedbackData);
    if (liveState.bellState) bellState = liveState.bellState;
    if (liveState.overrides) {
        const changed = JSON.stringify(overrides) !== JSON.stringify(liveState.overrides);
        if (changed) {
            Object.assign(overrides, liveState.overrides);
            applyOverrides();
        }
    }
}

async function pullState() {
    if (syncInFlight) return;
    syncInFlight = true;
    try {
        const res = await fetch(`sync_session.php?session_id=${SESSION_DATA.session_id}`);
        if (res.status === 404) {
            showToast('This session has been concluded. Returning to dashboard...');
            setTimeout(()=>{ window.location.href = '../dashboard/dashboard.php'; }, 2000);
            return;
        }
        const data = await res.json();
        if (data.success) {
            applyRemoteState(data.session, data.live_state || {});
            lastSuccessfulSyncAt = Date.now();
        }
    } catch (err) {
        console.error('Sync pull failed:', err);
    } finally {
        syncInFlight = false;
    }
}

setInterval(async () => {
    await pushState();
    await pullState();
}, SYNC_INTERVAL_MS);

// Any change to a synced field marks live_state dirty so the next cycle pushes it
document.getElementById('trainee-rows').addEventListener('input', queueLiveStateSync);
document.getElementById('trainee-rows').addEventListener('change', queueLiveStateSync);
document.getElementById('driver-rows').addEventListener('input', queueLiveStateSync);
document.getElementById('staff-rows').addEventListener('input', queueLiveStateSync);
document.getElementById('staff-rows').addEventListener('change', queueLiveStateSync);
document.getElementById('status-select').addEventListener('change', queueLiveStateSync);

// Initial load: seed local state from SESSION_DATA / LIVE_STATE if the page provided them
if (typeof SESSION_DATA !== 'undefined' && SESSION_DATA) {
    applyRemoteState(SESSION_DATA, typeof LIVE_STATE !== 'undefined' ? LIVE_STATE : {});
}

// Change listener for host select syncing discord ID:
document.getElementById('session-host-select')?.addEventListener('change', (e)=>{
  document.getElementById('session-host-discordid').value = STAFF_DIRECTORY[e.target.value] || '';
});