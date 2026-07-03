/* ================= STATE ================= */
const staffRoles = ['Main AST','Assistant','Co-Host','Internal Helper'];
let staffCount = 0;
let driverCount = 0;
let traineeCount = 0;
const timers = {};
const overrides = { 'session-details':false, 'trainees':false, 'staff-roles':false, 'drivers-disable':false, 'slot-order':false };
 
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
    const display = document.querySelector(`[data-timer="${row}"]`);
    const t = timers[row];
    if(action==='start'){
      const playBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
      if(!t.running){
        t.running = true;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        playBtn.classList.add('active');
        t.interval = setInterval(()=>{
          t.seconds--;
          display.textContent = fmt(t.seconds);
          display.classList.toggle('running', t.seconds > 60);
          display.classList.toggle('low', t.seconds <= 60 && t.seconds > 0);
          display.classList.toggle('expired', t.seconds <= 0);
        },1000);
      } else {
        t.running = false;
        clearInterval(t.interval);
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.classList.remove('active');
      }
    }
    if(action==='reset'){
      t.running = false;
      clearInterval(t.interval);
      t.seconds = COUNTDOWN_START;
      display.textContent = fmt(COUNTDOWN_START);
      display.classList.remove('running','low','expired');
      const playBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      playBtn.classList.remove('active');
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
function addStaffRow(){
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
  `;
  document.getElementById('staff-rows').appendChild(tr);
  applyOverrides();
}
document.getElementById('add-staff-btn').addEventListener('click', addStaffRow);
addStaffRow(); addStaffRow(); addStaffRow();
 
/* ================= DRIVER ROWS ================= */
function addDriverRow(){
  const idx = driverCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="cell-input driver-field" placeholder="username"/></td>
    <td><input class="cell-input driver-field" placeholder="username"/></td>
    <td style="text-align:center;"><input type="checkbox" class="chk driver-field"/></td>
  `;
  document.getElementById('driver-rows').appendChild(tr);
  applyOverrides();
}
document.getElementById('add-driver-btn').addEventListener('click', addDriverRow);
addDriverRow(); addDriverRow(); addDriverRow();
 
/* ================= FEEDBACK MODAL ================= */
const feedbackModal = document.getElementById('feedback-modal');
const ratingFields = ['setup','conflict','priority','rbtiming','overall'];
document.querySelectorAll('.rating-scale').forEach(scale=>{
  for(let i=1;i<=5;i++){
    const d = document.createElement('button');
    d.className = 'r-dot';
    d.textContent = i;
    d.type = 'button';
    d.addEventListener('click', ()=>{
      scale.querySelectorAll('.r-dot').forEach(x=>x.classList.remove('sel'));
      d.classList.add('sel');
    });
    scale.appendChild(d);
  }
});
 
let activeFeedbackBtn = null;
function openFeedbackModal(triggerBtn){
  activeFeedbackBtn = triggerBtn;
  const row = triggerBtn.dataset.row;
  const nameInput = document.querySelector(`tr[data-row="${row}"] .trainee-name`);
  document.getElementById('fb-trainee-name').value = nameInput ? nameInput.value : '';
  feedbackModal.classList.add('open');
}
function closeFeedbackModal(){
  feedbackModal.classList.remove('open');
  activeFeedbackBtn = null;
}
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
