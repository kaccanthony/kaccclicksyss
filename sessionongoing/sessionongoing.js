// sessionongoing.js
/* ================= STATE ================= */
const staffRoles = ['Main AST','Assistant','Co-Host','Internal Helper'];
let staffCount = 0;
let driverCount = 0;
let driversEverSynced = false;
let staffEverSynced = false;
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
/* ================= ZONE DATA and announcement template (must exist before the first trainee rows are built below) ================= */
const ZONE_DATA = {
  'Zone 1':  { coverage: 'WFD <-> STV/STB/CHP', notes: 'Willowfield <-> Stepford Victoria/Stepford Bay/City Hospital', depot: 'Willowfield C.S. / Marston Hill TMD / Beechley Kingsway C.S', depotNearby: 'Trinity Way TMD' },
  'Zone 2':  { coverage: 'SCN <-> WHF/SCE/SHS', notes: 'Stepford Central <-> Whitefield/Stepford East/Stepford High Street', depot: 'Trinity Way TMD / Whitefield Farm Park C.S. / Market Weighton TMD', depotNearby: 'Marston Hill TMD / Beechley Kingsway C.S' },
  'Zone 3':  { coverage: 'SHB <-> COX/EBR/WNG(M)', notes: 'St. Helens Bridge <-> Coxly/East Berrily/Whitney Green (Metro)', depot: 'Bodin MOC / Manea Hill TMD / Coxly Station C.S. (Station & Bypass)', depotNearby: 'Stoke Milton C.S. (WB)' },
  'Zone 4':  { coverage: 'NRH <-> WBN', notes: 'Newry Harbour <-> West Benton', depot: 'Meriden Grove TMD / Elmstead Park C.S', depotNearby: 'N/A' },
  'Zone 5':  { coverage: 'BEN <-> CON/PBE', notes: 'Benton <-> Connolly/Port Benton', depot: 'Harbour City TMD / Benton Station C.S.', depotNearby: 'Coxly Station C.S. (Station & Bypass) / Stoke Milton TMD (WB)' },
  'Zone 6':  { coverage: 'MGT <-> MGD/WNG(W)/BBG/USP', notes: 'Morganstown <-> Morganstown Docks/Whitney Green (Waterline)/Benton Bridge/Upper Staploe', depot: 'Stoke Milton C.S. (All directions) / Holbeck TMD', depotNearby: 'Manea Hill TMD (EB)' },
  'Zone 7':  { coverage: 'SAP <-> SAZ/SAX', notes: 'Stepford Airport Parkway <-> Airport Terminal 3/Airport Terminal 2', depot: 'Melrose Depot (Road 11 & 17) / Stoke Milton C.S. (NB)', depotNearby: 'N/A' },
  'Zone 8':  { coverage: 'SAW <-> EFD', notes: 'Airport West <-> Esterfield', depot: 'Melrose Depot (Road 2) / Esterfield TMD', depotNearby: 'N/A' },
  'Zone 9':  { coverage: 'WTN <-> MRC/LTW/RLB', notes: 'Water Newton <-> Millcastle Racecourse/Leighton West/Rayleigh Bay', depot: 'Faymere Green TMD (All directions) / Winstree Lane TMD', depotNearby: 'Stoke Milton C.S. (EB)' },
  'Zone 10': { coverage: 'LYN <-> MLC', notes: 'Llyn-By-The-Sea <-> Millcastle', depot: 'Laira TMD', depotNearby: 'Faymere Green TMD (SB)' },
};

const ZONE_MAP_IMG_URL = 'https://cdn.discordapp.com/attachments/1344385121075204136/1471103255022014637/attachment.gif?ex=69dc286b&is=69dad6eb&hm=328cff76bf4a3b7703ad46aebd80e999bb317d5d1b674c596b36ec9626bc4408&';

const ANNOUNCEMENT_TEMPLATE = `# May I have everyone drive in [ZONE]!
**Zone Coverage:**
[ZONE COVERAGE]
(*[NOTES]*)
**Preferred Depot**:
[DEPOT & SIDING (WITHIN ZONE)]
**Nearby Depot**:
[DEPOT & SIDING NEARBY ZONE]
@[TRAINEE] please wait for further instructions from @[TRAINER], as you will be signalling next!
## Zone Map
${ZONE_MAP_IMG_URL}`;

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
    overridesDirty = true;
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
  setLocked(document.getElementById('session-host-discordid'), true);
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
  badge.className = 'status-badge status-badge-large ' + s.cls;
  badge.innerHTML = `<span class="status-dot"></span> ${s.label}`;
});

/* ================= TRAINEE ROWS ================= */
const zones = ['Zone 1','Zone 2','Zone 3','Zone 4', 'Zone 5','Zone 6','Zone 7','Zone 8','Zone 9','Zone 10'];
let COUNTDOWN_START = (parseInt(SESSION_DATA.trainee_timer, 10) || 12) * 60; // from session_ongoing.trainee_timer

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

function playTimerWarningSound() {
    if (!PLAY_TRAINEE_WARNING_SOUND) return;
    const snd = document.getElementById('sound-trainee-warning');
    if (!snd) return;
    snd.currentTime = 0;
    snd.play().catch(()=>{});
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
    if (t.running) {
        if (live <= 120 && live > 0 && !t.warned2min) { t.warned2min = true; playTimerWarningSound(); }
        if (live <= 60 && live > 0 && !t.warned1min) { t.warned1min = true; playTimerWarningSound(); }
    }
    updateModalTimerIfOpen(row);
    if (pipWin && !pipWin.closed && String(pipRow) === String(row)) {
        if (pipKind === 'trainee') refreshTraineePipContent();
        if (pipKind === 'timer') refreshTimerPipContent();
    }
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
    t.warned2min = false;
    t.warned1min = false;
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
    if (t.remainingSeconds > 120) t.warned2min = false;
    if (t.remainingSeconds > 60) t.warned1min = false;
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

function renumberSlots(){
  let n = 1;
  document.querySelectorAll('#trainee-rows tr').forEach(tr=>{
    const slotEl = tr.querySelector('.slot-num');
    if(!slotEl || slotEl.textContent.trim() === 'Unalloc.') return;
    slotEl.textContent = ' ' + n;
    n++;
  });
}

function addTraineeRow(unallocated, uid){
  const idx = traineeCount++;
  const tr = document.createElement('tr');
  tr.dataset.row = idx;
  if (unallocated) tr.dataset.uid = uid || ('u_' + Math.random().toString(36).slice(2) + Date.now());
  tr.innerHTML = `
    <td style="text-align:center;">
      <button type="button" class="pip-btn" data-row="${idx}" title="Pop out this trainee (Picture-in-Picture)"><i class="fas fa-clone"></i></button>
    </td>
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
          <select class="cell-input trainee-detail-field zone-select" data-lock-msg="Trainee details are locked. Ask the host to enable Override Trainee Details.">
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
    <td style="text-align:center;">
      <button type="button" class="timer-pip-btn" data-row="${idx}" title="Pop out just this timer (Picture-in-Picture)"><i class="fas fa-stopwatch"></i></button>
    </td>
    <td style="text-align:center;"><input type="checkbox" class="chk attendance-chk"/></td>
    <td>
      <select class="cell-input trainer-detail-field trainer-name-select" data-lock-msg="Trainer assignment is locked. Ask the host to enable Override Trainer Assignment.">
        <option value="">— None —</option>
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
  refreshTrainerDropdowns();
  timers[idx] = { remainingSeconds: COUNTDOWN_START, running: false, syncedAt: Date.now(), totalMinutes: COUNTDOWN_START/60, setupSeconds: undefined, warned2min: false, warned1min: false };
  applyOverrides();
  renderAnnouncementPreview(idx);
  updateStatusLockState();
}
document.getElementById('add-trainee-btn').addEventListener('click', (e)=> {
  if(e.currentTarget.classList.contains('is-locked')) return;
  addTraineeRow(true);
  queueLiveStateSync();
  pushState();
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
          pushState();
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
      queueLiveStateSync();
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
    renumberSlots();
    queueLiveStateSync();
    return;
  }

  const fbBtn = e.target.closest('.feedback-btn');
  if(fbBtn){
    openFeedbackModal(fbBtn);
  }

  const delBtn = e.target.closest('.trainee-del-btn');
  if(delBtn){
      if(delBtn.classList.contains('is-locked')) return;
      const idx = parseInt(delBtn.dataset.row, 10) + 1;
      delete timers[delBtn.dataset.row];
      delBtn.closest('tr').remove();
      renumberSlots();
      updateStatusLockState();
      fetch('sync_session.php', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ session_id: SESSION_DATA.session_id, updates: {
              [`trainee_${idx}_name`]: '', [`trainee_${idx}_discord`]: '', [`trainee_${idx}_discord_id`]: '',
              [`trainee_${idx}_zone`]: null, [`trainee_${idx}_note`]: '', [`trainee_${idx}_trainer_name`]: ''
          }}),
      });
      return;
  }

const pipBtn = e.target.closest('.pip-btn');
    if(pipBtn){
      openTraineePip(pipBtn.dataset.row);
      return;
    }

const timerPipBtn = e.target.closest('.timer-pip-btn');
    if(timerPipBtn){
      openTimerPip(timerPipBtn.dataset.row);
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
    <td><select class="cell-input staff-username-select"><option value="">— Select —</option></select></td>
    <td style="text-align:center;"><input type="checkbox" class="chk"/></td>
    <td><input class="cell-input" placeholder="—"/></td>
    <td style="text-align:center;"><button type="button" class="row-del-btn staff-del-btn" data-lock-msg="${STAFF_DEL_LOCK_MSG}" title="Host + Override Staff Deletion required"><i class="fas fa-trash"></i></button></td>
  `;
  document.getElementById('staff-rows').appendChild(tr);
  populateStaffNameOptions(tr);
  applyOverrides();
  updateStaffAddState();
}

function populateStaffNameOptions(tr, preserveValue){
  const roleSel = tr.querySelector('.staff-role-select');
  const nameSel = tr.querySelector('.staff-username-select');
  if(!roleSel || !nameSel) return;
  const current = preserveValue !== undefined ? preserveValue : nameSel.value;
  const role = roleSel.value;
  let names;
  if(role === 'Co-Host') names = ELIGIBLE_STAFF['Co-Host'];
  else if(role === 'Assistant') names = ELIGIBLE_STAFF['Assistant'];
  else names = Object.keys(STAFF_DIRECTORY); // Main AST / Internal Helper — unrestricted for now
  nameSel.innerHTML = '<option value="">— Select —</option>' + names.map(n=>`<option value="${n}">${n}</option>`).join('');
  if(names.includes(current)) nameSel.value = current;
}

function updateStaffAddState(){
  document.getElementById('add-staff-btn').disabled = document.querySelectorAll('#staff-rows tr').length >= STAFF_LIMIT;
}

document.getElementById('add-staff-btn').addEventListener('click', ()=>{ addStaffRow(); staffCoreDirty = true; queueLiveStateSync(); });

function applyRemoteStaff(staffArr) {
    if (!Array.isArray(staffArr)) return;
    const tbody = document.getElementById('staff-rows');
    const activeInStaff = document.activeElement && tbody.contains(document.activeElement);
    if (activeInStaff) return; // don't yank focus/values while someone's mid-edit

    // Same rule as drivers — only reseed from session defaults on the very first load.
    if (!staffEverSynced && !staffArr.length) {
        staffEverSynced = true;
        seedStaffFromSession();
        return;
    }
    staffEverSynced = true;

    tbody.innerHTML = '';
    staffCount = 0;
    staffArr.forEach(s => {
        addStaffRow();
        const tr = document.querySelector('#staff-rows tr:last-child');
        if (s.role) tr.querySelector('.staff-role-select').value = s.role;
        populateStaffNameOptions(tr, s.discord || '');
        const notesInput = tr.querySelectorAll('.cell-input')[2];
        if (notesInput) notesInput.value = s.notes || '';
        if (notesInput) notesInput.value = s.notes || '';
        const chk = tr.querySelector('.chk');
        if (chk) chk.checked = !!s.attended;
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
    populateStaffNameOptions(tr, s.name);// Discord username column
  });
}
if (LIVE_STATE.staffShift && LIVE_STATE.staffShift.length) {
  applyRemoteStaff(LIVE_STATE.staffShift);
} else {
  seedStaffFromSession();
}
staffEverSynced = true;

document.getElementById('staff-rows').addEventListener('click', (e)=>{
  const delBtn = e.target.closest('.staff-del-btn');
  if(delBtn){
    if(delBtn.classList.contains('is-locked')) return;
    delBtn.closest('tr').remove();
    updateStaffAddState();
    staffCoreDirty = true;
    queueLiveStateSync();
  }
});

// Only one "Main AST" allowed at a time — assigning it to a row bumps whoever had it down to Assistant.
document.getElementById('staff-rows').addEventListener('change', (e)=>{
  const select = e.target.closest('.staff-role-select');
  if(!select) return;
  populateStaffNameOptions(select.closest('tr'));
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

    // Only seed 3 blank defaults the very first time this session is ever loaded.
    // After that, an empty array means someone deliberately deleted everything — respect it.
    let rows = driversArr;
    if (!driversEverSynced && !driversArr.length) {
        rows = [{discord:'',roblox:'',attended:false},{discord:'',roblox:'',attended:false},{discord:'',roblox:'',attended:false}];
    }
    driversEverSynced = true;

    tbody.innerHTML = '';
    driverCount = 0;
    rows.forEach(d => {
        addDriverRow();
        const tr = document.querySelector('#driver-rows tr:last-child');
        const inputs = tr.querySelectorAll('.driver-field');
        inputs[0].value = d.discord || '';
        inputs[1].value = d.roblox || '';
        inputs[2].checked = !!d.attended;
    });
}
document.getElementById('add-driver-btn').addEventListener('click', ()=>{ addDriverRow(); queueLiveStateSync(); });
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

function buildFeedbackMessageForRow(row){
  const rowEl = row !== null ? document.querySelector(`tr[data-row="${row}"]`) : null;
  const trainerFields = rowEl ? rowEl.querySelectorAll('.trainer-detail-field') : [];
  const trainerName = trainerFields[0] ? trainerFields[0].value.trim() : '';
  const zoneSelect = rowEl ? rowEl.querySelector('.zone-select') : null;
  const zoneVal = (zoneSelect && zoneSelect.value && zoneSelect.value !== 'Select') ? zoneSelect.value : '';
  const fb = row !== null ? getFeedbackData(row) : { trains:'', setup:'', conflict:'', priority:'', rbtiming:'', overall:'', notes:'' };
  const t = row !== null ? timers[row] : null;
  const setupTimeVal = t && t.setupSeconds !== undefined ? fmt(t.setupSeconds) : '';

  return `# Practice Feedback
**Trainer**: ${trainerName}
**Date of session**: ${formatSessionDateTime()}
**Zone**: ${zoneVal}
**Trains signalled**: ${fb.trains || ''}
**Set-up time**: ${setupTimeVal}

=========================

__**Zone Setup**__
${fb.setup || ''}

__**Conflict Handling**__
${fb.conflict || ''}

__**Priority Handling**__
${fb.priority || ''}

__**Rollbacks and Delay**__
${fb.rbtiming || ''}

__**Overall**__
${fb.overall || ''}

__*Notes/Advice*__
${fb.notes || ''}

If you believe you were unfairly assessed or have any additional questions, feel free to ask!
Thank you for attending.`;
}

function buildFeedbackMessage(){
  return activeFeedbackRow !== null ? buildFeedbackMessageForRow(activeFeedbackRow) : '';
}

function renderScriptPreview(minutes, targetContainer){
  const displayMinutes = minutes || Math.round(COUNTDOWN_START/60);
  const container = targetContainer || document.getElementById('script-preview');
  if(!container) return;
  container.innerHTML = '';
  SCRIPT_LINES.forEach(lineText=>{
    const resolvedText = lineText.replace(/XX/g, displayMinutes);
    const doc = container.ownerDocument;
    const line = doc.createElement('div');
    line.className = 'script-line';
    const textEl = doc.createElement('div');
    textEl.className = 'script-line-text';
    textEl.innerHTML = escapeForPreview(resolvedText);
    const copyBtn = doc.createElement('button');
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
  const trainerSelect = rowEl.querySelector('.trainer-name-select');

  const traineeName = (nameInput && nameInput.value.trim()) || '[TRAINEE]';
  const trainerName = (trainerSelect && trainerSelect.value) || '[TRAINER]';
  const zoneVal = (zoneSelect && zoneSelect.value && zoneSelect.value !== 'Select') ? zoneSelect.value : null;
  const zoneInfo = zoneVal ? ZONE_DATA[zoneVal] : null;

  return ANNOUNCEMENT_TEMPLATE
    .replaceAll('[ZONE COVERAGE]', zoneInfo ? zoneInfo.coverage : '[ZONE COVERAGE]')
    .replaceAll('[DEPOT & SIDING (WITHIN ZONE)]', zoneInfo ? zoneInfo.depot : '[DEPOT & SIDING (WITHIN ZONE)]')
    .replaceAll('[DEPOT & SIDING NEARBY ZONE]', zoneInfo ? zoneInfo.depotNearby : '[DEPOT & SIDING NEARBY ZONE]')
    .replaceAll('[NOTES]', zoneInfo ? zoneInfo.notes : '[NOTES]')
    .replaceAll('[TRAINEE]', traineeName)
    .replaceAll('[TRAINER]', trainerName)
    .replaceAll('[ZONE]', zoneVal || '[ZONE]');
}

function formatAnnouncementLine(line){
  if(/^_{2,}$/.test(line.trim())) return '<hr class="announcement-hr"/>';
  if(/^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(line.trim())){
    return `<img class="announcement-zone-img" src="${line.trim()}" alt="Zone map" loading="lazy"/>`;
  }
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
  const zoneSelect = rowEl.querySelector('.zone-select');

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

  // Auto-show the script in the modal only — the PiP's script view stays behind its own toggle.
  if (scriptPreviewEl && scriptToggleBtn) {
    scriptPreviewEl.style.display = 'flex';
    scriptToggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    scriptToggleBtn.title = 'Hide script';
    scriptToggleBtn.classList.add('active');
  }

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

/* ================= REAL PICTURE-IN-PICTURE (Document PiP) =================
   These open genuine always-on-top OS windows (window.documentPictureInPicture),
   the same API YouTube's own pop-out player uses — so they float over Roblox,
   Discord, or anything else, not just this browser tab. Browsers only allow ONE
   Document PiP window per tab at a time, so opening a new one (any kind) swaps
   out whichever is currently open, exactly like YouTube's own PiP behavior.
   Only Chrome/Edge support this API today; other browsers get a toast. */
let pipWin = null;
let pipKind = null;   // 'trainee' | 'timer' | 'feedback'
let pipRow  = null;
let pipRefreshInterval = null;

const FEEDBACK_FIELDS = [
  { key:'setup', label:'Setup' }, { key:'conflict', label:'Conflict Handling' },
  { key:'priority', label:'Priority' }, { key:'rbtiming', label:'RB & Timing' },
  { key:'overall', label:'Overall' }, { key:'notes', label:'Notes / Advice' },
];

function pipSupported(){ return 'documentPictureInPicture' in window; }

function copyStylesIntoPip(win){
  [...document.styleSheets].forEach(sheet=>{
    try{
      const rules = [...sheet.cssRules].map(r=>r.cssText).join('');
      const style = win.document.createElement('style');
      style.textContent = rules;
      win.document.head.appendChild(style);
    }catch(e){
      if(!sheet.href) return;
      const link = win.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      win.document.head.appendChild(link);
    }
  });
}

async function openPip(kind, row, buildFn, opts){
  if(!pipSupported()){
    showToast('Real pop-out windows need Chrome or Edge (Document Picture-in-Picture). This browser doesn\'t support it.');
    return;
  }
  if(pipWin && !pipWin.closed && pipKind === kind && String(pipRow) === String(row)){
    pipWin.focus();
    return;
  }
  try{
    const win = await window.documentPictureInPicture.requestWindow({
      width: opts?.width || 300,
      height: opts?.height || 260,
    });
    pipWin = win; pipKind = kind; pipRow = row;
    copyStylesIntoPip(win);
    win.document.title = opts?.title || 'Pop-out';
    buildFn(win);
    clearInterval(pipRefreshInterval);
    pipRefreshInterval = setInterval(()=>{ if(pipWin && !pipWin.closed) refreshActivePip(); }, 1000);
    win.addEventListener('pagehide', ()=>{
      if(pipWin === win){ pipWin = null; pipKind = null; pipRow = null; clearInterval(pipRefreshInterval); }
    }, { once:true });
  }catch(err){
    showToast('Could not open pop-out window.');
  }
}

function refreshActivePip(){
  if(!pipWin || pipWin.closed) return;
  if(pipKind === 'trainee') refreshTraineePipContent();
  else if(pipKind === 'timer') refreshTimerPipContent();
}

/* ---- Trainee pop-out: details, timer (incl. Setup Done), attendance, notes,
  and a condensed feedback form all in one window — feedback no longer gets
   its own pop-out since only one Document PiP window can be open at a time. ---- */
function buildTraineePip(win){
  win.document.body.innerHTML = `
    <div style="padding:14px;">
      <div class="trainee-pip-grid" id="tpip-grid"></div>
      <div class="timer-cell" id="tpip-timer" style="margin-top:12px;justify-content:center;flex-wrap:wrap;"></div>
      <div class="pip-row" id="tpip-setup-row" style="margin-top:6px;"></div>
      <div class="pip-row" style="margin-top:10px;"><span class="pip-label">Attendance</span><input type="checkbox" id="tpip-attendance"/></div>
      <div style="margin-top:10px;">
        <textarea id="tpip-note" rows="2" style="width:100%;" class="cell-input" placeholder="Notes for this trainee..."></textarea>
      </div>
      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span class="pip-label" style="font-weight:600;">Script</span>
          <button type="button" class="script-toggle-btn" id="tpip-script-toggle" title="Show script"><i class="fas fa-eye"></i></button>
        </div>
        <div class="script-preview" id="tpip-script-preview" style="display:none;"></div>
      </div>
      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span class="pip-label" style="font-weight:600;">Feedback</span>
          <button type="button" class="copy-feedback-btn" id="tpip-copy-fb" title="Copy full feedback message"><i class="fas fa-copy"></i></button>
        </div>
        <input class="cell-input" id="tpip-trains" placeholder="Trains signalled" style="width:100%;margin-bottom:8px;"/>
        <div class="feedback-pip-fields" id="tpip-fb-fields"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="feedback-btn" id="tpip-open-modal-btn" style="flex:1;" title="Open the full feedback editor with script preview"><i class="fas fa-up-right-and-down-left-from-center"></i> Full editor</button>
        <button class="complete-btn" id="tpip-complete-btn" style="flex:1;">Mark done</button>
      </div>
    </div>
  `;
  win.document.getElementById('tpip-fb-fields').innerHTML = FEEDBACK_FIELDS.map(f=>`
    <div><label>${f.label}</label><textarea rows="2" data-field="${f.key}"></textarea></div>
  `).join('');

  win.document.getElementById('tpip-note').addEventListener('input', (e)=>{
    const rowTextarea = document.querySelector(`tr[data-row="${pipRow}"] .trainee-notes-input`);
    if(rowTextarea) rowTextarea.value = e.target.value;
    queueLiveStateSync();
  });
  win.document.getElementById('tpip-attendance').addEventListener('change', (e)=>{
    const rowChk = document.querySelector(`tr[data-row="${pipRow}"] .chk`);
    if(rowChk) rowChk.checked = e.target.checked;
    queueLiveStateSync();
  });
  win.document.getElementById('tpip-trains').addEventListener('input', (e)=>{
    getFeedbackData(pipRow).trains = e.target.value;
    const modalTrains = document.getElementById('fb-trains');
    if(modalTrains && String(activeFeedbackRow) === String(pipRow)) modalTrains.value = e.target.value;
    queueLiveStateSync();
  });
  win.document.querySelectorAll('#tpip-fb-fields textarea').forEach(ta=>{
    ta.addEventListener('input', ()=>{
      getFeedbackData(pipRow)[ta.dataset.field] = ta.value;
      const modalTa = document.querySelector(`.feedback-text[data-field="${ta.dataset.field}"]`);
      if(modalTa && String(activeFeedbackRow) === String(pipRow)) modalTa.value = ta.value;
      queueLiveStateSync();
    });
  });
  win.document.getElementById('tpip-copy-fb').addEventListener('click', ()=>{
    win.navigator.clipboard.writeText(buildFeedbackMessageForRow(pipRow)).then(()=>{
      const btn = win.document.getElementById('tpip-copy-fb');
      btn.classList.add('copied');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(()=>{ btn.classList.remove('copied'); btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1200);
    });
  });
  win.document.getElementById('tpip-open-modal-btn').addEventListener('click', ()=>{
    const rowBtn = document.querySelector(`tr[data-row="${pipRow}"] .feedback-btn`);
    if(rowBtn) openFeedbackModal(rowBtn);
  });
  win.document.getElementById('tpip-complete-btn').addEventListener('click', ()=>{
    const rowBtn = document.querySelector(`tr[data-row="${pipRow}"] .complete-btn`);
    if(!rowBtn) return;
    const done = rowBtn.classList.toggle('done');
    rowBtn.innerHTML = done ? 'Done' : 'Mark done';
    updateStatusLockState();
    queueLiveStateSync();
    refreshTraineePipContent();
  });
  const tpipScriptToggle = win.document.getElementById('tpip-script-toggle');
  const tpipScriptPreview = win.document.getElementById('tpip-script-preview');
  if(tpipScriptToggle && tpipScriptPreview){
    tpipScriptToggle.addEventListener('click', ()=>{
      const hidden = tpipScriptPreview.style.display === 'none';
      tpipScriptPreview.style.display = hidden ? 'flex' : 'none';
      tpipScriptToggle.innerHTML = hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
      tpipScriptToggle.classList.toggle('active', hidden);
      if(hidden) renderScriptPreview(timers[pipRow] ? timers[pipRow].totalMinutes : undefined, tpipScriptPreview);
    });
  }
  refreshTraineePipContent();
}

function refreshTraineePipContent(){
  if(pipKind !== 'trainee' || !pipWin || pipWin.closed) return;
  const rowEl = document.querySelector(`tr[data-row="${pipRow}"]`);
  if(!rowEl) return;
  const name = rowEl.querySelector('.trainee-name')?.value || 'Trainee';
  const discordId = rowEl.querySelectorAll('.trainee-detail-field')[1]?.value || '—';
  const roblox = rowEl.querySelectorAll('.trainee-detail-field')[2]?.value || '—';
  const zone = rowEl.querySelector('select.trainee-detail-field')?.value || '—';
  const trainer = rowEl.querySelector('.trainer-name-select')?.value || '—';
  const done = rowEl.querySelector('.complete-btn')?.classList.contains('done');

  pipWin.document.title = name + ' — Pop-out';
  const grid = pipWin.document.getElementById('tpip-grid');
  if(grid) grid.innerHTML = `
    <div class="pip-row"><span class="pip-label">Name</span><span class="pip-value">${name}</span></div>
    <div class="pip-row"><span class="pip-label">Discord ID</span><span class="pip-value">${discordId}</span></div>
    <div class="pip-row"><span class="pip-label">Roblox</span><span class="pip-value">${roblox}</span></div>
    <div class="pip-row"><span class="pip-label">Zone</span><span class="pip-value">${zone}</span></div>
    <div class="pip-row"><span class="pip-label">Trainer</span><span class="pip-value">${trainer}</span></div>
  `;

  const timerHost = pipWin.document.getElementById('tpip-timer');
  if(timerHost && !timerHost.dataset.built){
    timerHost.dataset.built = '1';
    timerHost.innerHTML = `
      <span class="timer-display" id="tpip-timer-display"></span>
      <button class="timer-btn play" id="tpip-play" title="Start/pause"><i class="fas fa-play"></i></button>
      <button class="timer-btn" id="tpip-reset" title="Reset"><i class="fas fa-redo"></i></button>
      <button class="timer-btn setup-done" id="tpip-setup-done" style="width:24px" title="Mark setup done (stops timer)"><i class="fas fa-check"></i></button>
      <button class="timer-btn override" id="tpip-override" title="Override timer"><i class="fas fa-exclamation-triangle"></i></button>
    `;
    pipWin.document.getElementById('tpip-play').addEventListener('click', ()=> toggleTimer(pipRow));
    pipWin.document.getElementById('tpip-reset').addEventListener('click', ()=> resetTimer(pipRow));
    pipWin.document.getElementById('tpip-override').addEventListener('click', ()=>{
      const input = pipWin.prompt('Set timer to MM:SS:', fmt(computeCurrentRemaining(timers[pipRow])));
      if(input !== null) setTimerValue(pipRow, input);
    });
    pipWin.document.getElementById('tpip-setup-done').addEventListener('click', ()=>{
      const btn = pipWin.document.getElementById('tpip-setup-done');
      if(btn.classList.contains('done')) return; // locked once marked — use the Edit link instead
      btn.classList.add('done');
      recordSetupDone(pipRow);
      const rowBtn = document.querySelector(`.timer-btn.setup-done[data-row="${pipRow}"]`);
      if(rowBtn) rowBtn.classList.add('done');
      syncModalSetupDoneBtn(pipRow, true);
      refreshTraineePipContent();
    });
  }
  const t = timers[pipRow];
  const disp = pipWin.document.getElementById('tpip-timer-display');
  if(disp && t){
    const live = computeCurrentRemaining(t);
    disp.textContent = fmt(live);
    disp.classList.toggle('running', live > 60 && t.running);
    disp.classList.toggle('low', live <= 60 && live > 0);
    disp.classList.toggle('expired', live <= 0);
  }
  const playBtn = pipWin.document.getElementById('tpip-play');
  if(playBtn && t){ playBtn.innerHTML = t.running ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>'; playBtn.classList.toggle('active', t.running); }

  const rowSetupBtn = rowEl.querySelector('.timer-btn.setup-done');
  const setupDoneBtn = pipWin.document.getElementById('tpip-setup-done');
  const isSetupDone = !!(rowSetupBtn && rowSetupBtn.classList.contains('done'));
  if(setupDoneBtn) setupDoneBtn.classList.toggle('done', isSetupDone);
  const setupRow = pipWin.document.getElementById('tpip-setup-row');
  if(setupRow){
    setupRow.innerHTML = `<span class="pip-label">Setup time</span><span class="pip-setup-time-row"><span class="pip-setup-badge">${t && t.setupSeconds !== undefined ? fmt(t.setupSeconds) : '—'}</span>${isSetupDone ? '<button type="button" class="pip-setup-edit-btn" id="tpip-setup-override" title="Override setup time"><i class="fas fa-pen"></i></button>' : ''}</span>`;
    const overrideBtn = pipWin.document.getElementById('tpip-setup-override');
    if(overrideBtn) overrideBtn.addEventListener('click', ()=>{
      const current = t.setupSeconds !== undefined ? fmt(t.setupSeconds) : '00:00';
      const input = pipWin.prompt('Override setup time (MM:SS):', current);
      if(input === null) return;
      const parts = String(input).split(':').map(n => parseInt(n, 10) || 0);
      t.setupSeconds = parts.length === 2 ? (parts[0] * 60 + parts[1]) : (parseInt(input, 10) || 0);
      updateModalSetupTimeIfOpen(pipRow);
      queueLiveStateSync();
      refreshTraineePipContent();
    });
  }

  const attendance = pipWin.document.getElementById('tpip-attendance');
  const rowChk = rowEl.querySelector('.chk');
  if(attendance && pipWin.document.activeElement !== attendance) attendance.checked = !!(rowChk && rowChk.checked);

  const note = pipWin.document.getElementById('tpip-note');
  const rowNote = rowEl.querySelector('.trainee-notes-input');
  if(note && pipWin.document.activeElement !== note) note.value = rowNote ? rowNote.value : '';

  const fbData = getFeedbackData(pipRow);
  const trainsInput = pipWin.document.getElementById('tpip-trains');
  if(trainsInput && pipWin.document.activeElement !== trainsInput) trainsInput.value = fbData.trains || '';
  pipWin.document.querySelectorAll('#tpip-fb-fields textarea').forEach(ta=>{
    if(pipWin.document.activeElement !== ta) ta.value = fbData[ta.dataset.field] || '';
  });

  const completeBtn = pipWin.document.getElementById('tpip-complete-btn');
  if(completeBtn){ completeBtn.textContent = done ? 'Done' : 'Mark done'; completeBtn.classList.toggle('done', !!done); }
}

function openTraineePip(row){
  openPip('trainee', row, buildTraineePip, { width: 320, height: 560, title: 'Trainee pop-out' });
}

/* ---- Timer-only pop-out: just the running clock + controls ---- */
function buildTimerPip(win){
  const canControl = myRole !== 'assistant';
  win.document.body.innerHTML = `
    <div style="padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px;">
      <div id="tmpip-name" style="font-size:.8rem;color:var(--text-faint);"></div>
      <span class="timer-display" id="tmpip-display" style="font-size:2rem;"></span>
      <div class="timer-cell" id="tmpip-controls" style="justify-content:center;"></div>
      ${canControl ? '' : '<div style="font-size:.68rem;color:var(--text-faint);text-align:center;">View only — Assistants can\'t control the timer.</div>'}
    </div>
  `;
  if(canControl){
    const controls = win.document.getElementById('tmpip-controls');
    controls.innerHTML = `
      <button class="timer-btn play" id="tmpip-play" title="Start/pause"><i class="fas fa-play"></i></button>
      <button class="timer-btn" id="tmpip-reset" title="Reset"><i class="fas fa-redo"></i></button>
      <button class="timer-btn override" id="tmpip-override" title="Override timer"><i class="fas fa-exclamation-triangle"></i></button>
    `;
    win.document.getElementById('tmpip-play').addEventListener('click', ()=> toggleTimer(pipRow));
    win.document.getElementById('tmpip-reset').addEventListener('click', ()=> resetTimer(pipRow));
    win.document.getElementById('tmpip-override').addEventListener('click', ()=>{
      const input = win.prompt('Set timer to MM:SS:', fmt(computeCurrentRemaining(timers[pipRow])));
      if(input !== null) setTimerValue(pipRow, input);
    });
  }
  refreshTimerPipContent();
}

function refreshTimerPipContent(){
  if(pipKind !== 'timer' || !pipWin || pipWin.closed) return;
  const rowEl = document.querySelector(`tr[data-row="${pipRow}"]`);
  const name = rowEl?.querySelector('.trainee-name')?.value || ('Trainee ' + (parseInt(pipRow,10)+1));
  const nameEl = pipWin.document.getElementById('tmpip-name');
  if(nameEl) nameEl.textContent = name;
  pipWin.document.title = name + ' — Timer';
  const t = timers[pipRow];
  const disp = pipWin.document.getElementById('tmpip-display');
  if(disp && t){
    const live = computeCurrentRemaining(t);
    disp.textContent = fmt(live);
    disp.classList.toggle('running', live > 60 && t.running);
    disp.classList.toggle('low', live <= 60 && live > 0);
    disp.classList.toggle('expired', live <= 0);
  }
  const playBtn = pipWin.document.getElementById('tmpip-play');
  if(playBtn && t){ playBtn.innerHTML = t.running ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>'; playBtn.classList.toggle('active', t.running); }
}

function openTimerPip(row){
  openPip('timer', row, buildTimerPip, { width: 220, height: 210, title: 'Timer pop-out' });
}

// The "pop out" button in the full feedback modal now just opens the trainee
// pop-out (which already has the condensed feedback fields built in) — a
// separate feedback-only window isn't possible alongside it (one PiP window
// per tab).
document.getElementById('fb-popout').addEventListener('click', ()=>{
  if (activeFeedbackRow === null) return;
  openTraineePip(activeFeedbackRow);
  closeFeedbackModal();
});

const scriptToggleBtn = document.getElementById('script-toggle-btn');
const scriptPreviewEl = document.getElementById('script-preview');
if (scriptToggleBtn && scriptPreviewEl) {
  scriptToggleBtn.addEventListener('click', () => {
    const hidden = scriptPreviewEl.style.display === 'none';
    scriptPreviewEl.style.display = hidden ? 'flex' : 'none';
    scriptToggleBtn.innerHTML = hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    scriptToggleBtn.title = hidden ? 'Hide script' : 'Show script';
    scriptToggleBtn.classList.toggle('active', hidden);
  });
}

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
const sessionDurationSeconds = (parseInt(SESSION_DATA.session_duration, 10) || 0) * 60;
setInterval(()=>{
  const elapsed = Math.max(0, Math.floor((Date.now() - sessionStartMs) / 1000));
  const el = document.getElementById('global-timer-display');
  if(el) el.textContent = fmtHMS(elapsed);

  const overtimePill = document.getElementById('overtime-pill');
  const isOvertime = sessionDurationSeconds > 0 && elapsed > sessionDurationSeconds;
  if (el) el.classList.toggle('overtime', isOvertime);
  if (overtimePill) overtimePill.style.display = isOvertime ? 'inline-flex' : 'none';
}, 1000);

/* real sync indicator — only resets after an actual successful round-trip */
let lastSuccessfulSyncAt = Date.now();
setInterval(()=>{
  const secondsAgo = Math.floor((Date.now() - lastSuccessfulSyncAt) / 1000);
  const el = document.getElementById('sync-note');
  if (el) el.textContent = `synced ${secondsAgo}s ago`;
}, 1000);

/* ================= BELL SYSTEM ================= */
const BELL_BUTTON_COOLDOWN_MS = 5000;
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
    
  const hostIsInitiatorActive = bellState.active && bellState.initiatorRole === 'host';
  const hostCanReRing = hostIsInitiatorActive && bellState.ringCount < 3 && (now - bellState.lastRingAt) >= 5000;
  bellButtons.host.disabled = globalCooldownActive || localButtonCooldownUntil.host > now ||
    (bellState.active
      ? (hostIsInitiatorActive ? !hostCanReRing : bellState.acks.host)
      : false);

  const cohostIsInitiatorActive = bellState.active && bellState.initiatorRole === 'cohost';
  const cohostCanReRing = cohostIsInitiatorActive && bellState.ringCount < 3 && (now - bellState.lastRingAt) >= 5000;
  bellButtons.cohost.disabled = globalCooldownActive || localButtonCooldownUntil.cohost > now ||
    (bellState.active
      ? (cohostIsInitiatorActive ? !cohostCanReRing : bellState.acks.cohost)
      : false);
  bellButtons.assistant.disabled = globalCooldownActive || localButtonCooldownUntil.assistant > now ||
    (bellState.active ? bellState.acks.assistant : true);
  bellFabDot.classList.toggle('show', bellState.active);
  if(!sessionHasCohost) bellButtons.cohost.style.display = 'none'; // Button won't show if a co-host is not signed-up
  if(!sessionHasAssistant) bellButtons.assistant.style.display = 'none'; // Button won't show if an assistant is not signed-up
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

async function ringBell(role){
  try {
    const res = await fetch('bell_state.php', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ session_id: SESSION_DATA.session_id, action:'ring', role, client_id: myClientId })
    });
    const data = await res.json();
    if(!res.ok){ showToast(data.error || 'Could not ring bell.'); return; }
    bellState = mapServerBell(data);
    renderBellState();
    bellSounds.hostRing.currentTime = 0; bellSounds.hostRing.play().catch(()=>{});
    armButtonCooldown(role);
  } catch (err) {
    console.error('Bell ring failed:', err);
    showToast('Could not reach the bell system — is bell_state.php deployed alongside sessionongoing.php?');
  }
}
async function ackBell(role){
  try {
    const res = await fetch('bell_state.php', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ session_id: SESSION_DATA.session_id, action:'ack', role, client_id: myClientId })
    });
    const data = await res.json();
    if(!res.ok){ showToast(data.error || 'Could not acknowledge.'); return; }
    const prevState = bellState;
    bellState = mapServerBell(data);
    renderBellState();
    const snd = role === 'cohost' ? bellSounds.cohostAck : bellSounds.assistantAck;
    snd.currentTime = 0; snd.play().catch(()=>{});
    announceBellCycleEnd(prevState, bellState);
    armButtonCooldown(role);
  } catch (err) {
    console.error('Bell ack failed:', err);
    showToast('Could not reach the bell system — is bell_state.php deployed alongside sessionongoing.php?');
  }
}

function mapServerBell(s){
  return { active:s.active, initiatorRole:s.initiator_role, acks:s.acks,
          globalCooldownUntil: s.cooldown_until ? s.cooldown_until*1000 : 0,
          ringCount: s.ring_count || 0,
          lastRingAt: s.last_ring_at ? s.last_ring_at*1000 : 0 };
}

function announceBellCycleEnd(prevState, newState){
  if (!prevState.active || newState.active) return; // only fires on an active -> inactive transition
  const requiredRoles = ['host','cohost','assistant'].filter(r => {
    if (r === prevState.initiatorRole) return false;
    if (r === 'cohost' && !sessionHasCohost) return false;
    if (r === 'assistant' && !sessionHasAssistant) return false;
    return true;
  });
  const everyoneAcked = requiredRoles.every(r => prevState.acks[r]);
  showToast(everyoneAcked
    ? 'Everyone acknowledged the bell — entering a 5 minute cooldown.'
    : 'Bell timed out waiting on an acknowledgment — entering a 5 minute cooldown.');
}

async function pollBell(){
  try{
    const res = await fetch(`bell_state.php?session_id=${SESSION_DATA.session_id}`);
    if (!res.ok) throw new Error(`bell_state.php returned ${res.status}`);
    const data = await res.json();
    const prevState = bellState;
    bellState = mapServerBell(data);
    if(!prevState.active && bellState.active){ bellSounds.hostRing.currentTime=0; bellSounds.hostRing.play().catch(()=>{}); }
    ['cohost','assistant'].forEach(r=>{
      if(!prevState.acks[r] && bellState.acks[r]){
        const snd = r==='cohost' ? bellSounds.cohostAck : bellSounds.assistantAck;
        snd.currentTime=0; snd.play().catch(()=>{});
      }
    });
    announceBellCycleEnd(prevState, bellState);
    renderBellState();
  }catch(e){ console.error('Bell poll failed:', e); }
}
setInterval(pollBell, 3000);
pollBell();

// Local test mode: click a button to ring it (if idle) or ack it (if a bell is active) — lets you test the whole flow solo, on one page.
bellButtons.host.addEventListener('click', ()=>{
  if(myRole !== 'host'){ showToast('Only the Host can use this bell.'); return; }
  if(bellButtons.host.disabled) return;
  if(!bellState.active || bellState.initiatorRole === 'host') ringBell('host');
  else ackBell('host');
});
bellButtons.cohost.addEventListener('click', ()=>{
  if(myRole !== 'cohost'){ showToast('Only a Co-Host can use this bell.'); return; }
  if(bellButtons.cohost.disabled) return;
  if(!bellState.active || bellState.initiatorRole === 'cohost') ringBell('cohost');
  else ackBell('cohost');
});
bellButtons.assistant.addEventListener('click', ()=>{
  if(myRole !== 'assistant'){ showToast('Only an Assistant can use this bell.'); return; }
  if(bellButtons.assistant.disabled) return;
  if(!bellState.active){ showToast('Assistants can only acknowledge an active bell.'); return; }
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
document.querySelectorAll('.drivers-table, .staff-table').forEach(makeColumnsResizable);

/* ================= COLUMN VISIBILITY (Trainees panel only) ================= */
const TRAINEE_COLUMNS = [
  {n:1, label:'Pop-out'},
  {n:2, label:'Slot'},
  {n:3, label:'Trainee Discord'},
  {n:4, label:'Discord ID'},
  {n:5, label:'Roblox'},
  {n:6, label:'Zone'},
  {n:7, label:'Timer'},
  {n:8, label:'Timer Pop-out'},
  {n:9, label:'Attendance'},
  {n:10, label:'Trainer'},
  {n:11, label:'Trainer Discord ID'},
  {n:12, label:'Feedback'},
  {n:13, label:'Announcements'},
  {n:14, label:'Trainee Notes'},
  {n:15, label:'Completed'},
  {n:16, label:'Remove'},
];
// Pop-out columns (1, 8) are deliberately excluded — "Hide extras" never touches them.
const EXTRA_COLUMNS = [2,4,9,11,14,16];
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

  // Force a final push so anything typed in the last few seconds (trains, setup time,
  // feedback notes, etc.) is actually in the database before we archive and delete this row.
  queueLiveStateSync();
  await pushState();

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
let staffCoreDirty = false;
let overridesDirty = false;
let statusDirty = false;

function queueLiveStateSync() { pendingLiveStateFlush = true; }

function isEditingField(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// Core columns: real DB fields, safe to push straight through
function collectCoreUpdates() {
    const updates = {};
    if (statusDirty) {
        const statusVal = document.getElementById('status-select').value;
        if (statusVal !== 'concluded') { // 'concluded' only ever commits via the Conclude Session confirm flow
            updates.session_status = statusVal;
        }
        statusDirty = false;
    }

    let staffAttendance = '';
    document.querySelectorAll('#staff-rows .chk').forEach(cb => { staffAttendance += cb.checked ? '1' : '0'; });
    if (staffAttendance) updates.staff_attendance = staffAttendance;

    const traineeAttendanceParts = [];
    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        const chk = tr.querySelector('.attendance-chk');
        traineeAttendanceParts.push(chk && chk.checked ? '1' : '0');
    });
    if (traineeAttendanceParts.length) updates.trainee_attendance = traineeAttendanceParts.join(',');

    // Only recompute + push co_host1-4/assistant_1-4 when THIS client actually edited the
    // Staff panel (staffCoreDirty). Pushing it unconditionally on every sync tick — even
    // for unrelated changes like a trainee note — let any client's stale local staff-rows
    // view silently overwrite the real assignment for everyone else.
    if (staffCoreDirty) {
        const cohostCols = ['co_host1', 'co_host2', 'co_host3', 'co_host4/supervisor'];
        const assistantCols = ['assistant_1', 'assistant_2', 'assistant_3', 'assistant_4'];
        let cohostIdx = 0, assistantIdx = 0;
        document.querySelectorAll('#staff-rows tr').forEach(tr => {
            const role = tr.querySelector('.staff-role-select')?.value;
            const discord = tr.querySelector('.staff-username-select')?.value.trim();
            if (!discord) return;
            if (role === 'Co-Host' && cohostIdx < cohostCols.length) {
                updates[cohostCols[cohostIdx++]] = discord;
            } else if (assistantIdx < assistantCols.length) {
                updates[assistantCols[assistantIdx++]] = discord;
            }
        });
        staffCoreDirty = false;
    }

    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        const row = tr.dataset.row;
        const idx = parseInt(row, 10) + 1;
        const nameEl = tr.querySelector('.trainee-name');
        const detailFields = tr.querySelectorAll('.trainee-detail-field');
        const trainerFields = tr.querySelectorAll('.trainer-detail-field');
        if (nameEl) updates[`trainee_${idx}_name`] = nameEl.value.trim();
        if (detailFields[0]) updates[`trainee_${idx}_discord`] = detailFields[0].value.trim();
        if (detailFields[1]) updates[`trainee_${idx}_discord_id`] = detailFields[1].value.trim();
        if (detailFields[2]) updates[`trainee_${idx}_name`] = detailFields[2].value.trim();
        const zoneSelect = tr.querySelector('select.trainee-detail-field');
        if (zoneSelect) updates[`trainee_${idx}_zone`] = (zoneSelect.value && zoneSelect.value !== 'Select') ? parseInt(zoneSelect.value.replace('Zone ', ''), 10) : null;
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
        const discord = tr.querySelector('.staff-username-select')?.value.trim() || '';
        const notesInput = tr.querySelectorAll('.cell-input')[2]?.value.trim() || '';
        const attended = tr.querySelector('.chk')?.checked || false;
        return { role, discord, notes: notesInput, attended };
    });

    const completedRows = {};
    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        completedRows[tr.dataset.row] = tr.querySelector('.complete-btn')?.classList.contains('done') || false;
    });

    const slotOrder = Array.from(document.querySelectorAll('#trainee-rows tr'))
        .filter(tr => tr.querySelector('.slot-num')?.textContent.trim() !== 'Unalloc.')
        .map(tr => tr.dataset.row);

    const unallocatedTrainees = Array.from(document.querySelectorAll('#trainee-rows tr'))
        .filter(tr => tr.querySelector('.slot-num')?.textContent.trim() === 'Unalloc.')
        .map(tr => {
            const detailFields = tr.querySelectorAll('.trainee-detail-field');
            const trainerFields = tr.querySelectorAll('.trainer-detail-field');
            const zoneSelect = tr.querySelector('select.trainee-detail-field');
            const notesArea = tr.querySelector('.trainee-notes-input');
            return {
                uid: tr.dataset.uid,
                discord: detailFields[0]?.value.trim() || '',
                discordId: detailFields[1]?.value.trim() || '',
                roblox: detailFields[2]?.value.trim() || '',
                zone: (zoneSelect && zoneSelect.value !== 'Select') ? zoneSelect.value : '',
                notes: notesArea?.value.trim() || '',
                trainerName: trainerFields[0]?.value.trim() || '',
            };
        });

    const payload = {
        timers: timerState,
        drivers: drivers,
        staffShift: staffShift,
        feedbackData: feedbackData,
        completedRows: completedRows,
        slotOrder: slotOrder,
        unallocatedTrainees: unallocatedTrainees,
        timeTracker: timeTracker,
        mainAstNotes: document.getElementById('main-ast-notes')?.value || '',
    };
    if (overridesDirty) {
        payload.overrides = overrides;
        overridesDirty = false;
    }
    if (pendingAnnouncement) {
        payload.announcement = pendingAnnouncement;
        pendingAnnouncement = null;
    }
    return payload;
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
        const rowSetupBtn = document.querySelector(`.timer-btn.setup-done[data-row="${row}"]`);
        if (rowSetupBtn) rowSetupBtn.classList.toggle('done', remote.setupSeconds !== undefined && remote.setupSeconds !== null);
        syncModalSetupDoneBtn(row, remote.setupSeconds !== undefined && remote.setupSeconds !== null);
    });
}

// Diffs by stable uid instead of destroying/rebuilding every unalloc row on every poll.
// Previously idx came from an ever-incrementing local counter, so rows never matched up
// between clients (or even between polls on the same client), wiping out anything typed.
function applyRemoteUnallocated(arr) {
    if (!Array.isArray(arr)) return;
    const tbody = document.getElementById('trainee-rows');
    const active = document.activeElement;

    const incomingUids = new Set(arr.map(u => u.uid).filter(Boolean));
    tbody.querySelectorAll('tr').forEach(tr => {
        if (tr.querySelector('.slot-num')?.textContent.trim() === 'Unalloc.' && !incomingUids.has(tr.dataset.uid)) {
            if (active && tr.contains(active)) return; // don't remove a row someone's mid-editing
            delete timers[tr.dataset.row];
            tr.remove();
        }
    });

    arr.forEach(u => {
        if (!u.uid) return;
        let tr = tbody.querySelector(`tr[data-uid="${u.uid}"]`);
        if (!tr) {
            addTraineeRow(true, u.uid);
            tr = document.querySelector('#trainee-rows tr:last-child');
        }
        if (active && tr.contains(active)) return; // don't yank focus from whoever's typing in it

        const detailFields = tr.querySelectorAll('.trainee-detail-field');
        const trainerFields = tr.querySelectorAll('.trainer-detail-field');
        const zoneSelect = tr.querySelector('select.trainee-detail-field');
        const notesArea = tr.querySelector('.trainee-notes-input');
        if (detailFields[0]) detailFields[0].value = u.discord || '';
        if (detailFields[1]) detailFields[1].value = u.discordId || '';
        if (detailFields[2]) detailFields[2].value = u.roblox || '';
        if (zoneSelect && u.zone) zoneSelect.value = u.zone;
        if (notesArea) notesArea.value = u.notes || '';
        if (trainerFields[0]) {
            trainerFields[0].value = u.trainerName || '';
            if (trainerFields[1]) trainerFields[1].value = STAFF_DIRECTORY[u.trainerName] || '';
        }
        renderAnnouncementPreview(tr.dataset.row);
    });
}

function applyRemoteState(session, liveState) {
    const active = document.activeElement;

    const statusSelect = document.getElementById('status-select');
    const normalizedStatus = (session.session_status || '').toLowerCase().replace(/\s+/g, '');
    if (statusSelect.value !== normalizedStatus && [...statusSelect.options].some(o=>o.value===normalizedStatus)) {
        statusSelect.value = normalizedStatus;
        statusSelect.dispatchEvent(new Event('change'));
    }

    refreshTrainerDropdowns();

  if (liveState.slotOrder && !document.activeElement?.closest('#trainee-rows')) {
    const tbody = document.getElementById('trainee-rows');
    // Reorder allocated rows per slotOrder, THEN append unallocated rows after them —
    // otherwise appending only the allocated ones pushes unallocated rows upward each poll.
    const orderedAllocated = liveState.slotOrder
        .map(rowId => tbody.querySelector(`tr[data-row="${rowId}"]`))
        .filter(Boolean);
    const unallocatedRows = Array.from(tbody.querySelectorAll('tr'))
        .filter(tr => tr.querySelector('.slot-num')?.textContent.trim() === 'Unalloc.');
    [...orderedAllocated, ...unallocatedRows].forEach(tr => tbody.appendChild(tr));
    renumberSlots();
}

const attendanceParts = (session.trainee_attendance || '').split(',');
    document.querySelectorAll('#trainee-rows tr').forEach(tr => {
        const idx = parseInt(tr.dataset.row, 10) + 1;
        const nameEl = tr.querySelector('.trainee-name');
        const detailFields = tr.querySelectorAll('.trainee-detail-field');
        const trainerFields = tr.querySelectorAll('.trainer-detail-field');
        const notesArea = tr.querySelector('.trainee-notes-input');
        const attendanceChk = tr.querySelector('.attendance-chk');
        if (attendanceChk && active !== attendanceChk) {
            attendanceChk.checked = attendanceParts[idx - 1] === '1';
        }

        if (detailFields[0] && active !== detailFields[0]) detailFields[0].value = session[`trainee_${idx}_discord`] || '';
        if (detailFields[1] && active !== detailFields[1]) detailFields[1].value = session[`trainee_${idx}_discord_id`] || '';
        if (detailFields[2] && active !== detailFields[2]) detailFields[2].value = session[`trainee_${idx}_name`] || '';
        const zoneSelect = tr.querySelector('select.trainee-detail-field');
        if (zoneSelect && active !== zoneSelect && session[`trainee_${idx}_zone`]) zoneSelect.value = 'Zone ' + session[`trainee_${idx}_zone`];
        if (notesArea && active !== notesArea) notesArea.value = session[`trainee_${idx}_note`] || '';
        if (trainerFields[0] && active !== trainerFields[0]) {
            trainerFields[0].value = session[`trainee_${idx}_trainer_name`] || '';
            if (trainerFields[1]) trainerFields[1].value = STAFF_DIRECTORY[trainerFields[0].value] || '';
        }
        if (liveState.completedRows) {
            const done = !!liveState.completedRows[tr.dataset.row];
            const btn = tr.querySelector('.complete-btn');
            if (btn) { btn.classList.toggle('done', done); btn.innerHTML = done ? 'Done' : 'Mark done'; }
        }

        renderAnnouncementPreview(tr.dataset.row);
    });

    if (liveState.timers) applyRemoteTimers(liveState.timers);
    if (liveState.drivers) applyRemoteDrivers(liveState.drivers);
    if (liveState.staffShift) applyRemoteStaff(liveState.staffShift);
    if (liveState.unallocatedTrainees) applyRemoteUnallocated(liveState.unallocatedTrainees);
    if (liveState.timeTracker) { Object.assign(timeTracker, liveState.timeTracker); renderTimeTracker(); }
    if (liveState.mainAstNotes !== undefined) {
        const notesEl = document.getElementById('main-ast-notes');
        if (notesEl && document.activeElement !== notesEl) notesEl.value = liveState.mainAstNotes;
    }
    updateMainAstNotesVisibility();
    if (liveState.feedbackData) Object.assign(feedbackData, liveState.feedbackData);
    if (liveState.overrides) {
        const changed = JSON.stringify(overrides) !== JSON.stringify(liveState.overrides);
        if (changed) {
            Object.assign(overrides, liveState.overrides);
            applyOverrides();
        }
    }
    if (liveState.announcement && liveState.announcement.id !== lastSeenAnnouncementId) {
        lastSeenAnnouncementId = liveState.announcement.id;
        displayIncomingAnnouncement(liveState.announcement);
    }
}

async function pullState() {
    if (syncInFlight) return;
    syncInFlight = true;
    try {
        const res = await fetch(`sync_session.php?session_id=${SESSION_DATA.session_id}`);
        if (res.status === 404) {
            showToast('This session has been concluded by the host. Returning to dashboard...');
            setTimeout(()=>{ window.location.href = '../dashboard/dashboard.php'; }, 2500);
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
document.getElementById('staff-rows').addEventListener('input', ()=>{ staffCoreDirty = true; queueLiveStateSync(); });
document.getElementById('staff-rows').addEventListener('change', ()=>{ staffCoreDirty = true; queueLiveStateSync(); });
document.getElementById('staff-rows').addEventListener('change', refreshTrainerDropdowns);
document.getElementById('staff-rows').addEventListener('input', refreshTrainerDropdowns);
document.getElementById('staff-rows').addEventListener('change', updateMainAstNotesVisibility);
document.getElementById('staff-rows').addEventListener('input', updateMainAstNotesVisibility);

/* ================= TIME TRACKER (Host only) — BST/GMT wall-clock stamps ================= */
const TIME_TRACKER_KEYS = ['briefingStart', 'sgShiftStart', 'screenieTime'];
const timeTracker = (LIVE_STATE.timeTracker && typeof LIVE_STATE.timeTracker === 'object') ? { ...LIVE_STATE.timeTracker } : {};

function formatUKTime(ts){
  if(!ts) return null;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts));
}

// Converts a "HH:MM" the host typed (meant as UK wall-clock time, today) into a real epoch ms,
// correctly accounting for BST vs GMT without needing a timezone library.
function londonTimeStringToTimestamp(hh, mm){
  const now = new Date();
  const ukDateParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const y = +ukDateParts.find(p => p.type === 'year').value;
  const mo = +ukDateParts.find(p => p.type === 'month').value;
  const d = +ukDateParts.find(p => p.type === 'day').value;
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  const guessUkStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(guess));
  const [guessH, guessM] = guessUkStr.split(':').map(Number);
  const diffMinutes = (hh * 60 + mm) - (guessH * 60 + guessM);
  return guess + diffMinutes * 60000;
}

function renderTimeTracker(){
  TIME_TRACKER_KEYS.forEach(key => {
    const row = document.querySelector(`.time-tracker-row[data-key="${key}"]`);
    const valueEl = document.getElementById(`tt-${key}-value`);
    const recordBtn = document.querySelector(`.tt-record-btn[data-key="${key}"]`);
    const editBtn = document.querySelector(`.tt-edit-btn[data-key="${key}"]`);
    const ts = timeTracker[key];
    if(valueEl) valueEl.textContent = ts ? `${formatUKTime(ts)} BST/GMT` : '— not recorded —';
    if(row) row.dataset.recorded = ts ? 'true' : 'false';
    if(recordBtn) recordBtn.style.display = ts ? 'none' : '';
    if(editBtn) editBtn.style.display = ts ? '' : 'none';
  });
}

document.querySelectorAll('.tt-record-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    timeTracker[btn.dataset.key] = Date.now(); // real UTC epoch — always correct, no conversion needed
    renderTimeTracker();
    queueLiveStateSync();
  });
});

document.querySelectorAll('.tt-edit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    const current = timeTracker[key] ? formatUKTime(timeTracker[key]) : '00:00';
    const input = prompt('Override time (HH:MM, 24h, BST/GMT):', current);
    if(input === null) return;
    const m = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
    if(!m){ showToast('Enter the time as HH:MM.'); return; }
    timeTracker[key] = londonTimeStringToTimestamp(parseInt(m[1], 10), parseInt(m[2], 10));
    renderTimeTracker();
    queueLiveStateSync();
  });
});

renderTimeTracker();

/* ================= MAIN AST NOTES (synced, visible to Host + current Main AST) ================= */
function isCurrentUserMainAst(){
  return Array.from(document.querySelectorAll('#staff-rows tr')).some(tr =>
    tr.querySelector('.staff-role-select')?.value === 'Main AST' &&
    tr.querySelector('.staff-username-select')?.value === MY_DISPLAY_NAME
  );
}

function updateMainAstNotesVisibility(){
  const panel = document.getElementById('main-ast-notes-panel');
  const notesEl = document.getElementById('main-ast-notes');
  if(!panel || !notesEl) return;
  const canEdit = isCurrentUserMainAst();
  panel.style.display = (isHost || canEdit) ? '' : 'none';
  notesEl.readOnly = !canEdit;
  notesEl.placeholder = canEdit
    ? 'Notes for the end-of-session report (the Host can see this too, live)...'
    : 'Only the current Main AST can edit this — you\'re viewing as Host.';
}
updateMainAstNotesVisibility();

document.getElementById('main-ast-notes').addEventListener('input', () => {
  if(!isCurrentUserMainAst()) return; // read-only viewers (host) can't push edits
  queueLiveStateSync();
});

/* ================= GENERATE REPORT (Host only) ================= */
function getStaffDiscordNamesByRole(role){
  return Array.from(document.querySelectorAll('#staff-rows tr'))
    .filter(tr => tr.querySelector('.staff-role-select')?.value === role)
    .map(tr => tr.querySelector('.staff-username-select')?.value.trim())
    .filter(Boolean);
}

function buildReportText(){
  const joinOrDash = arr => arr.length ? arr.join('\n') : '—';

  const hostName = SESSION_DATA.host || '';
  const dateVal = document.getElementById('session-date-input')?.value || SESSION_DATA.session_date || '';
  const dp = dateVal.split('-'); // yyyy-mm-dd -> dd/mm/yyyy
  const dateFormatted = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : dateVal;

  const mainAstList = getStaffDiscordNamesByRole('Main AST');
  const mainAst = mainAstList[0] || '';
  const assistants = getStaffDiscordNamesByRole('Assistant');
  if(mainAst) assistants.unshift(mainAst); // Main AST is mentioned again here
  const cohosts = getStaffDiscordNamesByRole('Co-Host');
  const ihs = getStaffDiscordNamesByRole('Internal Helper');

  const traineeRows = Array.from(document.querySelectorAll('#trainee-rows tr'))
    .filter(tr => (tr.querySelector('.trainee-name')?.value || '').trim() !== '');
  const allocated = traineeRows.filter(tr => !tr.dataset.uid);
  const unalloc = traineeRows.filter(tr => tr.dataset.uid);

  const cancelledNoShow = traineeRows
    .filter(tr => !tr.querySelector('.chk')?.checked)
    .map(tr => tr.querySelector('.trainee-name').value.trim());

  const drivers = Array.from(document.querySelectorAll('#driver-rows tr'))
    .map(tr => tr.querySelectorAll('.driver-field')[0]?.value.trim())
    .filter(Boolean);

  let n = 1;
  const traineeLines = [...allocated, ...unalloc].map(tr => {
    const name = tr.querySelector('.trainee-name')?.value.trim() || '';
    const trainer = tr.querySelector('.trainer-name-select')?.value.trim() || '';
    return `T${n++}: ${name} - ${trainer}`;
  });

  const mainAstNotes = document.getElementById('main-ast-notes')?.value.trim() || '';

  return `========REPORT BASED ON THE SIGNALLING PRACTICE==========
Host: ${hostName}
Date: ${dateFormatted}
Time: ${formatUKTime(Date.now())} BST/GMT

----------
Actual Briefing start: ${timeTracker.briefingStart ? formatUKTime(timeTracker.briefingStart) : '—'}
Actual SG Shift start: ${timeTracker.sgShiftStart ? formatUKTime(timeTracker.sgShiftStart) : '—'}
Actual Screenie time: ${timeTracker.screenieTime ? formatUKTime(timeTracker.screenieTime) : '—'}

----------

Main AST:
${mainAst || '—'}

Assistants:
${joinOrDash(assistants)}

Co-Hosts:
${joinOrDash(cohosts)}
IH:(If any):
${joinOrDash(ihs)}

Total no. of trainees in panel: ${traineeRows.length}

Cancelled/No-show trainee:
${joinOrDash(cancelledNoShow)}

Driver(s) if any:
${joinOrDash(drivers)}

Trainee data:
S.no | Trainee | Trainer
${traineeLines.length ? traineeLines.join('\n') : '—'}

Notes from Main AST(if any):
${mainAstNotes || '—'}

=======TO WHOM IT MAY BE CONCERNED=========`;
}

document.getElementById('generate-report-btn')?.addEventListener('click', () => {
  const text = buildReportText();
  navigator.clipboard.writeText(text).then(() => {
    showToast('Report copied to clipboard!');
  }).catch(() => {
    showToast('Could not copy — check clipboard permissions.');
  });
});
document.getElementById('session-host-select')?.addEventListener('change', refreshTrainerDropdowns);
document.getElementById('status-select').addEventListener('change', ()=>{ statusDirty = true; queueLiveStateSync(); });

// Initial load: seed local state from SESSION_DATA / LIVE_STATE if the page provided them
if (typeof SESSION_DATA !== 'undefined' && SESSION_DATA) {
    refreshTrainerDropdowns();
    applyRemoteState(SESSION_DATA, typeof LIVE_STATE !== 'undefined' ? LIVE_STATE : {});
}

// Change listener for host select syncing discord ID:
document.getElementById('session-host-select')?.addEventListener('change', (e)=>{
  document.getElementById('session-host-discordid').value = STAFF_DIRECTORY[e.target.value] || '';
});

function getEligibleTrainers(){
  const names = [document.getElementById('session-host-select')?.value].filter(Boolean);
  document.querySelectorAll('#staff-rows tr').forEach(tr=>{
    if(tr.querySelector('.staff-role-select')?.value === 'Co-Host'){
      const n = tr.querySelector('.staff-username-select')?.value.trim();
      if(n) names.push(n);
    }
  });
  return [...new Set(names)];
}
function refreshTrainerDropdowns(){
  const names = getEligibleTrainers();
  document.querySelectorAll('.trainer-name-select').forEach(sel=>{
    const current = sel.value;
    sel.innerHTML = '<option value="">— None —</option>' + names.map(n=>`<option value="${n}">${n}</option>`).join('');
    if(names.includes(current)) sel.value = current;
  });
}

/* ================= HOST ANNOUNCEMENT BROADCAST ================= */
let pendingAnnouncement = null;
let lastSeenAnnouncementId = (LIVE_STATE.announcement && LIVE_STATE.announcement.id) || null;

const announceFab = document.getElementById('announce-fab');
const announceWidget = document.getElementById('announce-widget');
const announcePanel = document.getElementById('announce-panel');

if (announceFab) {
  document.getElementById('announce-panel-close').addEventListener('click', ()=> announcePanel.classList.remove('open'));
  document.addEventListener('click', (e)=>{
    if (!e.target.closest('#announce-widget')) announcePanel.classList.remove('open');
  });

  (function enableAnnounceDrag(){
    let dragging = false, moved = false, offsetX = 0, offsetY = 0;
    announceFab.addEventListener('mousedown', (e)=>{
      dragging = true; moved = false;
      const rect = announceWidget.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e)=>{
      if(!dragging) return;
      moved = true;
      const maxLeft = window.innerWidth - announceFab.offsetWidth;
      const maxTop = window.innerHeight - announceFab.offsetHeight;
      announceWidget.style.left = Math.min(Math.max(0, e.clientX - offsetX), maxLeft) + 'px';
      announceWidget.style.right = 'auto';
      announceWidget.style.top = Math.min(Math.max(0, e.clientY - offsetY), maxTop) + 'px';
      announceWidget.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', ()=>{
      if(dragging && !moved) announcePanel.classList.toggle('open');
      dragging = false;
    });
  })();

  document.getElementById('announce-send-btn').addEventListener('click', ()=>{
    const input = document.getElementById('announce-message-input');
    const message = input.value.trim();
    if (!message) return;
    pendingAnnouncement = {
      id: Date.now() + '_' + myClientId,
      message: message,
      senderName: SESSION_DATA.host || 'Host',
      sentAt: Date.now(),
    };
    lastSeenAnnouncementId = pendingAnnouncement.id; // don't show it to myself
    queueLiveStateSync();
    pushState();
    input.value = '';
    announcePanel.classList.remove('open');
    showToast('Announcement sent to everyone.');
  });
}

function showAnnouncementFullscreen(text){
  document.getElementById('announce-fullscreen-text').textContent = text;
  document.getElementById('announce-fullscreen').classList.add('show');
}
document.getElementById('announce-fullscreen-close')?.addEventListener('click', ()=>{
  document.getElementById('announce-fullscreen').classList.remove('show');
});

function showAnnouncementBanner(text){
  document.getElementById('announce-banner-text').textContent = text;
  document.getElementById('announce-banner').classList.add('show');
  setTimeout(()=> document.getElementById('announce-banner').classList.remove('show'), 12000);
}
document.getElementById('announce-banner-close')?.addEventListener('click', ()=>{
  document.getElementById('announce-banner').classList.remove('show');
});

function displayIncomingAnnouncement(ann){
  if (!ANNOUNCEMENT_ENABLED_PREF) return;
  const text = `${ann.senderName}: ${ann.message}`;
  const snd = document.getElementById('sound-announcement');
  if (snd) { snd.currentTime = 0; snd.play().catch(()=>{}); }
  if (ANNOUNCEMENT_DISPLAY_PREF === 'fullscreen') showAnnouncementFullscreen(text);
  else if (ANNOUNCEMENT_DISPLAY_PREF === 'banner') showAnnouncementBanner(text);
  else showToast(text);
}

/* ================= STATION SCREENSHOT GENERATOR (visible to all staff) ================= */
// Pulled from your existing ZONE_DATA coverage codes — a starting list, not an
// authoritative SCR station roster. Edit/expand freely.
const STATION_LIST = [
  {code:'WFD', name:'Willowfield'}, {code:'STV', name:'Stepford Victoria'},
  {code:'STB', name:'Stepford Bay'}, {code:'CHP', name:'City Hospital'},
  {code:'SCN', name:'Stepford Central'}, {code:'WHF', name:'Whitefield'},
  {code:'SCE', name:'Stepford East'}, {code:'SHS', name:'Stepford High Street'},
  {code:'SHB', name:'St. Helens Bridge'}, {code:'COX', name:'Coxly'},
  {code:'EBR', name:'East Berrily'}, {code:'WNG', name:'Whitney Green'},
  {code:'NRH', name:'Newry Harbour'}, {code:'WBN', name:'West Benton'},
  {code:'BEN', name:'Benton'}, {code:'CON', name:'Connolly'},
  {code:'PBE', name:'Port Benton'}, {code:'MGT', name:'Morganstown'},
  {code:'MGD', name:'Morganstown Docks'}, {code:'BBG', name:'Benton Bridge'},
  {code:'USP', name:'Upper Staploe'}, {code:'SAP', name:'Stepford Airport Parkway'},
  {code:'SAZ', name:'Airport Terminal 3'}, {code:'SAX', name:'Airport Terminal 2'},
  {code:'SAW', name:'Airport West'}, {code:'EFD', name:'Esterfield'},
  {code:'WTN', name:'Water Newton'}, {code:'MRC', name:'Millcastle Racecourse'},
  {code:'LTW', name:'Leighton West'}, {code:'RLB', name:'Rayleigh Bay'},
  {code:'LYN', name:'Llyn-By-The-Sea'}, {code:'MLC', name:'Millcastle'},
];

// You didn't give exact wording for this one like you did the other templates —
// this is a placeholder, edit freely.
function buildStationAnnouncement(station){
  return `📸 Taking a screenshot at **${station.name}** (${station.code})!\nFeel free to stop by if you're nearby.`;
}

const stationSelect = document.getElementById('station-select');
if(stationSelect){
  stationSelect.innerHTML = STATION_LIST.map(s=>`<option value="${s.code}">${s.code} — ${s.name}</option>`).join('');

  document.getElementById('station-shuffle-btn').addEventListener('click', ()=>{
    const random = STATION_LIST[Math.floor(Math.random() * STATION_LIST.length)];
    stationSelect.value = random.code;
  });

  document.getElementById('station-copy-btn').addEventListener('click', ()=>{
    const station = STATION_LIST.find(s => s.code === stationSelect.value) || STATION_LIST[0];
    const btn = document.getElementById('station-copy-btn');
    navigator.clipboard.writeText(buildStationAnnouncement(station)).then(()=>{
      btn.classList.add('copied');
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(()=>{ btn.classList.remove('copied'); btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1200);
    });
  });
}