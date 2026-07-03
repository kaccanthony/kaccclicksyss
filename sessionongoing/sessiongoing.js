// ── build trainee rows (10 shown) ──
const zones = ['Zone A','Zone B','Zone C','Zone D'];
const rowsBody = document.getElementById('trainee-rows');
const rowCount = 10;
let html = '';
for (let i = 0; i < rowCount; i++) {
  html += `
    <tr data-row="${i}">
      <td style="color:var(--text-faint);font-size:.74rem;">Slot ${i+1}</td>
      <td><input class="cell-input" placeholder="username"/></td>
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
          <span class="timer-display" data-timer="${i}">00:00</span>
          <button class="timer-btn play" data-action="start" data-row="${i}" title="Start/pause"><i class="fas fa-play"></i></button>
          <button class="timer-btn" data-action="reset" data-row="${i}" title="Reset"><i class="fas fa-rotate-left"></i></button>
        </div>
      </td>
      <td style="text-align:center;"><input type="checkbox" class="chk"/></td>
      <td><input class="cell-input" placeholder="Trainer name"/></td>
      <td><input class="cell-input" placeholder="Discord ID"/></td>
      <td><textarea class="cell-input" rows="1" placeholder="Notes for this trainee..."></textarea></td>
      <td><input class="cell-input" placeholder="—"/></td>
    </tr>`;
}
rowsBody.innerHTML = html;

// ── per-row timers ──
const timers = {}; // row -> {seconds, interval, running}
function fmt(s){
  const m = String(Math.floor(s/60)).padStart(2,'0');
  const sec = String(s%60).padStart(2,'0');
  return `${m}:${sec}`;
}
document.querySelectorAll('.timer-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const row = btn.dataset.row;
    const action = btn.dataset.action;
    const display = document.querySelector(`[data-timer="${row}"]`);
    if(!timers[row]) timers[row] = {seconds:0, interval:null, running:false};
    const t = timers[row];

    if(action==='start'){
      const playBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
      if(!t.running){
        t.running = true;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        playBtn.classList.add('active');
        display.classList.add('running');
        t.interval = setInterval(()=>{
          t.seconds++;
          display.textContent = fmt(t.seconds);
        },1000);
      } else {
        t.running = false;
        clearInterval(t.interval);
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.classList.remove('active');
        display.classList.remove('running');
      }
    }
    if(action==='reset'){
      t.running = false;
      clearInterval(t.interval);
      t.seconds = 0;
      display.textContent = '00:00';
      display.classList.remove('running');
      const playBtn = document.querySelector(`.timer-btn.play[data-row="${row}"]`);
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      playBtn.classList.remove('active');
    }
  });
});

// ── soundboard trigger (demo: local flash only; wire to poll/AJAX endpoint) ──
document.querySelectorAll('.sb-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    btn.classList.remove('fired');
    void btn.offsetWidth;
    btn.classList.add('fired');
    // TODO: POST to trigger_sound.php { sound: btn.dataset.sound }
    // then all clients pick it up on their next 5s poll of sound_events
  });
});

// ── mock sync indicator (replace with real poll timestamp) ──
let lastSync = 0;
setInterval(()=>{
  lastSync += 1;
  document.getElementById('sync-note').textContent = `synced ${lastSync}s ago`;
  if(lastSync >= 5) lastSync = 0;
}, 1000);