/* ================= STATE ================= */
const staffRoles = ['Main AST','Assistant','Co-Host','Internal Helper'];
let staffCount = 0;
let driverCount = 0;
let traineeCount = 0;
const timers = {};
const overrides = { 'session-details':false, 'trainees':false, 'staff-roles':false, 'drivers-disable':false, 'slot-order':false, 'staff-delete':false };

// TODO: replace with the real logged-in role from your PHP session once wired up
const isHost = true;
const staffDelBtn = document.querySelector('.ovr-btn[data-ovr="staff-delete"]');
if(staffDelBtn && isHost) staffDelBtn.classList.add('visible');
 
/* ================= OVERRIDE TOGGLES ================= */
document.querySelectorAll('.ovr-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const key = btn.dataset.ovr;
    overrides[key] = !overrides[key];
    btn.classList.toggle('on', overrides[key]);
    applyOverrides();
  });
});
 
function applyOverrides(){
  // Session details lock
  document.querySelectorAll('.details-field').forEach(f=> f.disabled = !overrides['session-details']);
  const tag = document.getElementById('details-lock-tag');
  if(overrides['session-details']){
    tag.className = 'lock-tag is-unlocked';
    tag.innerHTML = '<i class="fas fa-lock-open"></i> Unlocked (override active)';
  } else {
    tag.className = 'lock-tag is-locked';
    tag.innerHTML = '<i class="fas fa-lock"></i> Locked';
  }
 
  // Trainee add button
  document.getElementById('add-trainee-btn').disabled = !overrides['trainees'];
  document.getElementById('add-trainee-btn').innerHTML = overrides['trainees']
    ? '<i class="fas fa-plus"></i> Add unallocated trainee'
    : '<i class="fas fa-plus"></i> Add unallocated trainee (requires Override Trainees)';
 
     // Trainee row delete — same override as adding trainees
  document.querySelectorAll('.trainee-del-btn').forEach(b => b.disabled = !overrides['trainees']);

  // Staff row delete — host + staff-delete override required
  document.querySelectorAll('.staff-del-btn').forEach(b => b.disabled = !(isHost && overrides['staff-delete']))

  // Staff role selects
  document.querySelectorAll('.staff-role-select').forEach(s=> s.disabled = !overrides['staff-roles']);
 
  // Driver inputs
  document.querySelectorAll('.driver-field').forEach(f=> f.disabled = overrides['drivers-disable']);
 
  // Slot order buttons
  document.querySelectorAll('.order-btn').forEach(b=> b.disabled = !overrides['slot-order']);
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
const zones = ['Zone A','Zone B','Zone C','Zone D'];
const COUNTDOWN_START = 12*60; // 12 minutes
 
function fmt(s){
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(s);
  const m = String(Math.floor(abs/60)).padStart(2,'0');
  const sec = String(abs%60).padStart(2,'0');
  return `${sign}${m}:${sec}`;
}

function updateTimerDisplay(row){
  const t = timers[row];
  const rowDisplay = document.querySelector(`[data-timer="${row}"]`);
  if(rowDisplay){
    rowDisplay.textContent = fmt(t.seconds);
    rowDisplay.classList.toggle('running', t.seconds > 60 && t.running);
    rowDisplay.classList.toggle('low', t.seconds <= 60 && t.seconds > 0);
    rowDisplay.classList.toggle('expired', t.seconds <= 0);
  }
  updateModalTimerIfOpen(row);
}

function toggleTimer(row){
  const t = timers[row];
  if(!t) return;
  const rowPlayBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
  if(!t.running){
    t.running = true;
    if(rowPlayBtn){ rowPlayBtn.innerHTML = '<i class="fas fa-pause"></i>'; rowPlayBtn.classList.add('active'); }
    syncModalPlayBtn(row, true);
    t.interval = setInterval(()=>{ t.seconds--; updateTimerDisplay(row); }, 1000);
  } else {
    t.running = false;
    clearInterval(t.interval);
    if(rowPlayBtn){ rowPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; rowPlayBtn.classList.remove('active'); }
    syncModalPlayBtn(row, false);
  }
}

function resetTimer(row){
  const t = timers[row];
  if(!t) return;
  t.running = false;
  clearInterval(t.interval);
  t.seconds = COUNTDOWN_START;
  const rowPlayBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
  if(rowPlayBtn){ rowPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; rowPlayBtn.classList.remove('active'); }
  syncModalPlayBtn(row, false);
  updateTimerDisplay(row);
}

function setTimerValue(row, mmss){
  const t = timers[row];
  if(!t) return;
  const parts = String(mmss).split(':').map(n => parseInt(n,10) || 0);
  t.seconds = parts.length === 2 ? (parts[0]*60 + parts[1]) : (parseInt(mmss,10) || 0);
  updateTimerDisplay(row);
}

function syncModalPlayBtn(row, running){
  if(String(activeFeedbackRow) !== String(row)) return;
  const btn = document.getElementById('fb-timer-toggle');
  if(!btn) return;
  btn.innerHTML = running ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
  btn.classList.toggle('active', running);
}

function updateModalTimerIfOpen(row){
  if(String(activeFeedbackRow) !== String(row)) return;
  const disp = document.getElementById('fb-timer-display');
  if(disp) disp.textContent = fmt(timers[row].seconds);
}

function addTraineeRow(unallocated){
  const idx = traineeCount++;
  const tr = document.createElement('tr');
  tr.dataset.row = idx;
  tr.innerHTML = `
    <td>
      <div class="slot-cell">
        <button class="order-btn" data-dir="up" data-row="${idx}" disabled><i class="fas fa-caret-up"></i></button>
        <span class="slot-num">${unallocated ? 'Unalloc.' : 'Slot '+(idx+1)}</span>
        <button class="order-btn" data-dir="down" data-row="${idx}" disabled><i class="fas fa-caret-down"></i></button>
      </div>
    </td>
    <td><input class="cell-input trainee-name" placeholder="username"/></td>
    <td><input class="cell-input" placeholder="Discord ID"/></td>
    <td><input class="cell-input" placeholder="username"/></td>
    <td>
      <select class="cell-input">
        <option>Select</option>
        ${zones.map(z=>`<option>${z}</option>`).join('')}
      </select>
    </td>
    <td>
      <div class="timer-cell">
        <span class="timer-display" data-timer="${idx}">${fmt(COUNTDOWN_START)}</span>
        <button class="timer-btn play" data-action="start" data-row="${idx}" title="Start/pause"><i class="fas fa-play"></i></button>
        <button class="timer-btn" data-action="reset" data-row="${idx}" title="Reset to 12:00"><i class="fas fa-rotate-left"></i></button>
        <button class="timer-btn setup-done" data-action="setup-done" data-row="${idx}" title="Mark setup done (stops timer)"><i class="fas fa-check"></i></button>
        <button class="timer-btn override" data-action="override" data-row="${idx}" title="Override timer value"><i class="fas fa-sliders"></i></button>
      </div>
    </td>
    <td style="text-align:center;"><input type="checkbox" class="chk"/></td>
    <td><input class="cell-input" placeholder="Trainer name"/></td>
    <td><input class="cell-input" placeholder="Discord ID"/></td>
    <td>
      <button class="feedback-btn" data-row="${idx}"><i class="fas fa-comment-dots"></i> Feedback</button>
    </td>
    <td><textarea class="cell-input" rows="1" placeholder="Notes for this trainee..."></textarea></td>
    <td><input class="cell-input" placeholder="—"/></td>
    <td>
      <button class="complete-btn" data-row="${idx}"><i class="fas fa-circle-check"></i> Mark done</button>
    </td>
    <td style="text-align:center;">
      <button class="row-del-btn trainee-del-btn" data-row="${idx}" disabled title="Requires Override Trainees"><i class="fas fa-trash"></i></button>
    </td>
  `;
  document.getElementById('trainee-rows').appendChild(tr);
  timers[idx] = { seconds: COUNTDOWN_START, interval:null, running:false };
  applyOverrides();
}
document.getElementById('add-trainee-btn').addEventListener('click', ()=> addTraineeRow(true));
for(let i=0;i<10;i++) addTraineeRow(false);
 
/* timer controls (event delegation) */
document.getElementById('trainee-rows').addEventListener('click', (e)=>{
  const timerBtn = e.target.closest('.timer-btn');
  if(timerBtn){
    const row = timerBtn.dataset.row;
    const action = timerBtn.dataset.action;
    if(action === 'start') toggleTimer(row);
    if(action === 'reset') resetTimer(row);
    if(action === 'setup-done'){
      const t = timers[row];
      t.running = false;
      clearInterval(t.interval);
      syncModalPlayBtn(row, false);
      const rowPlayBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
      if(rowPlayBtn){ rowPlayBtn.innerHTML = '<i class="fas fa-play"></i>'; rowPlayBtn.classList.remove('active'); }
      timerBtn.classList.toggle('done');
    }
    if(action === 'override'){
      const input = prompt('Set timer to MM:SS (e.g. 05:30):', fmt(timers[row].seconds));
      if(input !== null) setTimerValue(row, input);
    }
    return;
  }
 
  const completeBtn = e.target.closest('.complete-btn');
  if(completeBtn){
    const done = completeBtn.classList.toggle('done');
    completeBtn.innerHTML = done
      ? '<i class="fas fa-circle-check"></i> Done'
      : '<i class="fas fa-circle-check"></i> Mark done';
    return;
  }
 
  const orderBtn = e.target.closest('.order-btn');
  if(orderBtn && !orderBtn.disabled){
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
  if(delBtn && !delBtn.disabled){
    delete timers[delBtn.dataset.row];
    delBtn.closest('tr').remove();
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

function addStaffRow(){
  if(document.querySelectorAll('#staff-rows tr').length >= STAFF_LIMIT) return;
  const idx = staffCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="cell-input staff-role-select" disabled>
        ${staffRoles.map(r=>`<option>${r}</option>`).join('')}
      </select>
    </td>
    <td><input class="cell-input" placeholder="username"/></td>
    <td style="text-align:center;"><input type="checkbox" class="chk"/></td>
    <td><input class="cell-input" placeholder="—"/></td>
    <td style="text-align:center;"><button type="button" class="row-del-btn staff-del-btn" disabled title="Host + Override Staff Deletion required"><i class="fas fa-trash"></i></button></td>
  `;
  document.getElementById('staff-rows').appendChild(tr);
  applyOverrides();
  updateStaffAddState();
}

function updateStaffAddState(){
  document.getElementById('add-staff-btn').disabled = document.querySelectorAll('#staff-rows tr').length >= STAFF_LIMIT;
}

document.getElementById('add-staff-btn').addEventListener('click', addStaffRow);
addStaffRow(); addStaffRow(); addStaffRow();

document.getElementById('staff-rows').addEventListener('click', (e)=>{
  const delBtn = e.target.closest('.staff-del-btn');
  if(delBtn && !delBtn.disabled){
    delBtn.closest('tr').remove();
    updateStaffAddState();
  }
});
/* ================= DRIVER ROWS ================= */
function addDriverRow(){
  const idx = driverCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="cell-input driver-field" placeholder="username"/></td>
    <td><input class="cell-input driver-field" placeholder="username"/></td>
    <td style="text-align:center;"><input type="checkbox" class="chk driver-field"/></td>
    <td style="text-align:center;"><button type="button" class="row-del-btn driver-del-btn" title="Remove driver"><i class="fas fa-trash"></i></button></td>
  `;
  document.getElementById('driver-rows').appendChild(tr);
  applyOverrides();
}
document.getElementById('add-driver-btn').addEventListener('click', addDriverRow);
addDriverRow(); addDriverRow(); addDriverRow();

document.getElementById('driver-rows').addEventListener('click', (e)=>{
  const delBtn = e.target.closest('.driver-del-btn');
  if(delBtn) delBtn.closest('tr').remove();
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

function renderScriptPreview(){
  const container = document.getElementById('script-preview');
  container.innerHTML = '';
  SCRIPT_LINES.forEach(lineText=>{
    const line = document.createElement('div');
    line.className = 'script-line';
    const textEl = document.createElement('div');
    textEl.className = 'script-line-text';
    textEl.innerHTML = escapeForPreview(lineText);
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'script-copy-btn';
    copyBtn.title = 'Copy this line';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.addEventListener('click', ()=>{
      navigator.clipboard.writeText(lineText).then(()=>{
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

let activeFeedbackBtn = null;
let activeFeedbackRow = null;

function openFeedbackModal(triggerBtn){
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
  document.getElementById('fb-timer-display').textContent = fmt(t.seconds);
  syncModalPlayBtn(row, t.running);

  feedbackModal.classList.add('open');
}
function closeFeedbackModal(){
  feedbackModal.classList.remove('open');
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
  const input = prompt('Set timer to MM:SS (e.g. 05:30):', fmt(timers[activeFeedbackRow].seconds));
  if(input !== null) setTimerValue(activeFeedbackRow, input);
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
 
/* ================= INIT ================= */
applyOverrides();
 
/* mock sync indicator */
let lastSync = 0;
setInterval(()=>{
  lastSync += 1;
  document.getElementById('sync-note').textContent = `synced ${lastSync}s ago`;
  if(lastSync >= 5) lastSync = 0;
}, 1000);
 
/* soundboard */
document.querySelectorAll('.sb-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    btn.classList.remove('fired');
    void btn.offsetWidth;
    btn.classList.add('fired');
    // TODO: POST to trigger_sound.php { sound: btn.dataset.sound }
  });
});

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
document.querySelectorAll('#trainee-scroll table, .drivers-table, .staff-table').forEach(makeColumnsResizable);