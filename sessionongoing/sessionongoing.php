<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>YSS – Live Session</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
<link rel="stylesheet" href="sessionongoing.css?v=<?= filemtime(__DIR__ . '/sessionongoing.css') ?>"/>
<style>

</style>
</head>
<body>
<div id="bg"></div>

<header class="topbar">
  <div class="logo-wrap">
    <div class="pulse-ring"></div>
    <div class="pulse-ring ring2"></div>
    <div class="logo-img"></div>
  </div>
  <span class="app-name">YSS Session Manager</span>
  <div class="live-pill"><span class="live-dot"></span> LIVE SESSION</div>
  <span class="sync-note" id="sync-note">synced 2s ago</span>
  <a href="../dashboard/dashboard.php" class="back-btn" style="margin-left:14px;"><i class="fas fa-arrow-left"></i> Dashboard</a>
</header>

<main>
  <div class="session-head">
    <div>
      <div class="session-title">Session #482 — Vlackar</div>
      <div class="session-sub">Viewing as <strong>Trainer</strong> · edits are locked by default — use overrides below to unlock specific sections</div>
    </div>
  </div>

  <!-- Override controls -->
  <section class="panel">
    <div class="panel-title">Session Controls <span style="font-weight:400;color:var(--text-faint);text-transform:none;letter-spacing:0;">— overrides prevent accidental edits until switched on</span></div>
    <div class="override-columns">
      <div class="override-col">
        <div class="override-col-title">Session</div>
        <button class="ovr-btn" data-ovr="session-details"><span class="sw"></span><i class="fas fa-lock"></i> Override Session Details</button>
        <button class="ovr-btn" data-ovr="trainees"><span class="sw"></span><i class="fas fa-user-plus"></i> Override Trainees</button>
        <button class="ovr-btn" data-ovr="trainee-details"><span class="sw"></span><i class="fas fa-id-card"></i> Override Trainee Details</button>
        <button class="ovr-btn" data-ovr="slot-order"><span class="sw"></span><i class="fas fa-arrow-up-wide-short"></i> Override Slot Ordering</button>
      </div>
      <div class="override-col">
        <div class="override-col-title">Assistant Control</div>
        <button class="ovr-btn" data-ovr="staff-roles"><span class="sw"></span><i class="fas fa-user-shield"></i> Allow Assistant Override Staff Roles</button>
        <button class="ovr-btn" data-ovr="drivers-disable"><span class="sw"></span><i class="fas fa-ban"></i> Disable Assistant Input on Drivers</button>
      </div>
      <div class="override-col">
        <div class="override-col-title">Host Control</div>
        <button class="ovr-btn" data-ovr="trainer-details"><span class="sw"></span><i class="fas fa-chalkboard-user"></i> Override Trainer Assignment</button>
        <button class="ovr-btn host-only" data-ovr="staff-delete"><span class="sw"></span><i class="fas fa-user-slash"></i> Override Staff Deletion (Host only)</button>
        <button class="ovr-btn host-only dangerous" data-ovr="allow-all"><span class="sw"></span><i class="fas fa-triangle-exclamation"></i> Allow Override for Everyone (Dangerous)</button>
      </div>
    </div>
  </section>

  <!-- Session info -->
  <section class="panel">
    <div class="panel-title">
      Session Details
      <span class="lock-tag is-locked" id="details-lock-tag"><i class="fas fa-lock"></i> Locked</span>
    </div>
    <div class="info-grid" id="details-grid">
      <div class="info-cell">
        <div class="info-label">Session Host</div>
        <div class="info-value"><select class="cell-input details-field" data-lock-msg="Session details are locked. Ask the host to enable Override Session Details."><option>Vlackar</option><option>Mikael</option></select></div>
      </div>
      <div class="info-cell">
        <div class="info-label">Discord ID</div>
        <div class="info-value"><input class="cell-input details-field" data-lock-msg="Session details are locked. Ask the host to enable Override Session Details." value="479880148842184725" placeholder="Discord ID"/></div>
      </div>
      <div class="info-cell">
        <div class="info-label">Session Date</div>
        <div class="info-value"><input class="cell-input details-field" id="session-date-input" data-lock-msg="Session details are locked. Ask the host to enable Override Session Details." type="date"/></div>
      </div>
      <div class="info-cell">
        <div class="info-label">Session Time</div>
        <div class="info-value"><input class="cell-input details-field" id="session-time-input" data-lock-msg="Session details are locked. Ask the host to enable Override Session Details." type="time" lang="en-GB"/></div>
      </div>
        <div class="info-cell status-cell" style="grid-column:1/3;">
        <div class="status-row status-row-select">
          <div class="info-label">Session Status</div>
          <select class="cell-input" id="status-select" data-lock-msg="Session status unlocks once every trainee is marked done, or via Override Session Details.">
            <option value="inprogress">In Progress</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="concluded">Concluded</option>
          </select>
          <div class="status-unlock-hint" id="status-unlock-hint">Locked — unlocks once all trainees are marked done</div>
        </div>
        <div class="status-row status-row-badge">
          <span class="status-badge status-badge-large status-inprogress" id="status-badge"><span class="status-dot"></span> In Progress</span>
        </div>
      </div>
      <div class="info-cell" style="grid-column:3/4;">
        <div class="info-label">Trainee Signal Time</div>
        <div class="signal-time-wrap">
          <input type="number" class="cell-input details-field" id="signal-time-input" min="1" max="60" value="12" data-lock-msg="Session details are locked. Ask the host to enable Override Session Details."/>
          <span class="signal-time-suffix">min</span>
          <button type="button" class="mini-override-btn details-field" id="signal-time-apply" data-lock-msg="Session details are locked. Ask the host to enable Override Session Details."><i class="fas fa-check"></i></button>
        </div>
        <div class="status-unlock-hint">Applies to every trainee's countdown</div>
      </div>
      <div class="info-cell" style="grid-column:4/5;">
        <div class="info-label">Session Elapsed Time</div>
        <div class="global-timer-value" id="global-timer-display">00:00:00</div>
      </div>
  </section>

  <!-- Trainees table -->
  <section class="panel">
  <div class="panel-title">
      Trainees Panel
      <span style="font-weight:400;color:var(--text-faint);text-transform:none;letter-spacing:0;font-size:.68rem;">scroll wheel over the table scrolls sideways · ctrl+scroll still zooms the page</span>
      <div class="column-controls">
        <button type="button" class="col-ctrl-btn" id="hide-extras-btn">Hide extras</button>
        <button type="button" class="col-ctrl-btn" id="show-all-cols-btn">Show all</button>
        <div class="col-picker-wrap">
          <button type="button" class="col-ctrl-btn" id="col-picker-toggle"><i class="fas fa-table-columns"></i> Columns</button>
          <div class="col-picker-menu" id="col-picker-menu"></div>
        </div>
      </div>
    </div>
    <div class="table-wrap" id="trainee-scroll">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Trainee Discord</th>
            <th>Discord ID</th>
            <th>Roblox</th>
            <th>Zone</th>
            <th>Timer</th>
            <th>Attendance</th>
            <th>Trainer</th>
            <th>Trainer Discord ID</th>
            <th>Feedback</th>
            <th style="min-width:200px;">Announcements</th>
            <th style="min-width:150px;">Trainee Notes</th>
            <th>Completed</th>
            <th style="width:44px;">Remove</th>
          </tr>
        </thead>
        <tbody id="trainee-rows"></tbody>
      </table>
    </div>
    <div class="add-row-bar">
      <button class="add-btn" id="add-trainee-btn" data-lock-msg="This requires the Override Trainees toggle. Ask the host to enable it."><i class="fas fa-plus"></i> Add unallocated trainee (requires Override Trainees)</button>
    </div>
  </section>

  <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:20px;">
    <!-- Drivers -->
    <section class="panel">
      <div class="panel-title drivers">Drivers</div>
      <div class="table-wrap">
          <table class="drivers-table">
            <thead><tr><th>Discord</th><th>Roblox</th><th>Attendance</th><th style="width:40px;"></th></tr></thead>
            <tbody id="driver-rows"></tbody>
          </table>
        </div>
      <div class="add-row-bar">
        <button class="add-btn" id="add-driver-btn"><i class="fas fa-plus"></i> Add driver</button>
      </div>
    </section>

    <!-- Staff -->
    <section class="panel">
      <div class="panel-title staff">Staff</div>
      <div class="table-wrap">
        <table class="staff-table">
          <thead><tr><th>Role in Shift</th><th>Discord</th><th>Attendance</th><th>Notes</th><th style="width:40px;"></th></tr></thead>
          <tbody id="staff-rows"></tbody>
        </table>
      </div>
      <div class="add-row-bar">
        <button class="add-btn" id="add-staff-btn"><i class="fas fa-plus"></i> Add staff member</button>
      </div>
    </section>
  </div>

<section class="panel conclude-panel host-only" id="conclude-panel">
  <div class="panel-title">Session Wrap-Up</div>
  <div class="conclude-panel-body">
    <p class="conclude-desc">Concluding the session finalizes it — only available while the session is In Progress or Cancelled.</p>
    <button type="button" class="mbtn danger conclude-btn is-locked" id="conclude-session-btn" data-lock-msg="Conclude Session is only available while the status is Cancelled or Concluded.">
      <i class="fas fa-flag-checkered"></i> Conclude Session
    </button>
  </div>
</section>
</main>
<!-- Floating Bell Widget -->
<div class="bell-widget" id="bell-widget">
  <div class="bell-panel" id="bell-panel">
    <div class="bell-panel-header">
      <span><i class="fas fa-bell"></i> Bell System</span>
      <button type="button" class="bell-panel-close" id="bell-panel-close"><i class="fas fa-times"></i></button>
    </div>
    <div class="bell-panel-body">
      <button class="bell-btn" id="bell-host" title="Ring Host Bell">
        <i class="fas fa-bell"></i><span>Host Bell</span>
        <div class="bell-cooldown-fill" id="bell-host-cooldown"></div>
      </button>
      <button class="bell-btn" id="bell-cohost" title="Co-host Response">
        <i class="fas fa-reply"></i><span>Co-host</span>
        <div class="bell-cooldown-fill" id="bell-cohost-cooldown"></div>
      </button>
      <button class="bell-btn" id="bell-assistant" title="Assistant Response">
        <i class="fas fa-reply"></i><span>Assistant</span>
        <div class="bell-cooldown-fill" id="bell-assistant-cooldown"></div>
      </button>
    </div>
  </div>
  <button class="bell-fab" id="bell-fab" title="Open Bell System">
    <i class="fas fa-bell"></i>
    <span class="bell-fab-dot" id="bell-fab-dot"></span>
  </button>
</div>

<audio id="sound-host-bell" src="TrainerBuzzer.ogg" preload="auto"></audio>
<audio id="sound-cohost-ack" src="CoHostBuzzer.ogg" preload="auto"></audio>
<audio id="sound-assistant-ack" src="AssistantBuzzer.ogg" preload="auto"></audio>

<!-- Toasts -->
<div class="toast-container" id="toast-container"></div>

<!-- Confirm Modal (fail-safe for dangerous overrides) -->
<div class="modal-overlay" id="confirm-modal">
  <div class="modal confirm-modal-box">
    <div class="modal-head confirm-modal-head">
      <h2 id="confirm-title">Are you sure?</h2>
    </div>
    <div class="modal-body">
      <p id="confirm-message" class="confirm-message"></p>
      <div class="modal-footer">
        <button class="mbtn" id="confirm-cancel">Cancel</button>
        <button class="mbtn danger" id="confirm-ok">Yes, allow it</button>
      </div>
    </div>
  </div>
</div>

<!-- Feedback Modal -->
<div class="modal-overlay" id="feedback-modal">
  <div class="modal">
    <div class="modal-head">
      <h2>TRAINER FEEDBACK</h2>
      <button class="modal-close" id="modal-close"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="mf-grid">
        <div class="mf-field">
          <label>Zone</label>
          <select id="fb-zone" class="locked-field" data-lock-msg="This can't be edited here — override Trainee Details in the Trainee panel to change it there."><option>Select</option><option>Zone A</option><option>Zone B</option><option>Zone C</option><option>Zone D</option></select>
        </div>
        <div class="mf-field">
          <label>Date</label>
          <input type="date" id="fb-date" class="locked-field" data-lock-msg="Session date can't be edited here."/>
        </div>
        <div class="mf-field">
          <label>Name (Trainee)</label>
          <input type="text" id="fb-trainee-name" class="locked-field" data-lock-msg="This can't be edited here — override Trainee Details in the Trainee panel to change it there." placeholder="Trainee name"/>
        </div>
        <div class="mf-field">
          <label>Trains</label>
          <input type="text" id="fb-trains" placeholder="Trains"/>
        </div>
        <div class="mf-field">
          <label>Setup time</label>
          <div class="setup-time-wrap">
            <input type="text" id="fb-setup-time" class="locked-field" data-lock-msg="This field is locked — use the override button next to it to set the setup time." placeholder="—"/>
            <button type="button" class="mini-override-btn" id="fb-setup-override" title="Override setup time"><i class="fas fa-exclamation-triangle"></i></button>
          </div>
        </div>
        <div class="mf-field copy-feedback-field">
          <button type="button" class="copy-feedback-btn" id="copy-feedback-btn" title="Copy feedback message"><i class="fas fa-copy"></i></button>
          <span class="copy-feedback-label">Copy feedback message</span>
        </div>
      </div>
      </div>

      <!-- ▼ NEW: mirrors the trainee row's timer, no need to close the modal ▼ -->
      <div class="modal-timer-box">
        <span class="modal-timer-label">Trainee Timer</span>
        <span class="timer-display" id="fb-timer-display">12:00</span>
        <button class="timer-btn play" id="fb-timer-toggle" title="Start/pause"><i class="fas fa-play"></i></button>
        <button class="timer-btn" id="fb-timer-reset" title="Reset to 12:00"><i class="fas fa-redo"></i></button>
        <button class="timer-btn setup-done labeled" id="fb-setup-done" title="Mark setup done"><i class="fas fa-check"></i>Setup Done</button>
        <button class="timer-btn override" id="fb-timer-override" title="Override timer value"><i class="fas fa-exclamation-triangle"></i> Override</button>
      </div>
      <!-- ▲ end new block ▲ -->


      <!-- Script section -->
      <div class="script-feedback-grid">
        <div class="script-col">
          <div class="mf-section-label">Script <span class="script-hint">read-only — tap the copy icon on a line</span></div>
          <div class="script-preview" id="script-preview"><!-- lines injected by JS via SCRIPT_LINES --></div>
        </div>

        <div class="feedback-col">
          <div class="mf-section-label">Feedback</div>

          <div class="feedback-row">
              <label class="feedback-label">Setup</label>
              <textarea class="cell-input feedback-text"
                  data-field="setup"
                  placeholder="Feedback on setup..."></textarea>
          </div>

          <div class="feedback-row">
              <label class="feedback-label">Conflict Handling</label>
              <textarea class="cell-input feedback-text"
                  data-field="conflict"
                  placeholder="Feedback on conflict handling..."></textarea>
          </div>

          <div class="feedback-row">
              <label class="feedback-label">Priority</label>
              <textarea class="cell-input feedback-text"
                  data-field="priority"
                  placeholder="Feedback on priority..."></textarea>
          </div>

          <div class="feedback-row">
              <label class="feedback-label">RB &amp; Timing</label>
              <textarea class="cell-input feedback-text"
                  data-field="rbtiming"
                  placeholder="Feedback on RB &amp; timing..."></textarea>
          </div>

          <div class="feedback-row">
              <label class="feedback-label">Overall</label>
              <textarea class="cell-input feedback-text"
                  data-field="overall"
                  placeholder="Overall feedback..."></textarea>
          </div>

          <div class="feedback-row">
              <label class="feedback-label">Notes / Advice</label>
              <textarea class="cell-input feedback-text"
                  data-field="notes"
                  placeholder="Write notes and advice for the trainee..."></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="mbtn" id="fb-cancel">Cancel</button>
        <button class="mbtn primary" id="fb-save">Save feedback</button>
      </div>
    </div>
  </div>
</div>

<!-- Floating Trainee Notes viewer — draggable, non-blocking -->
<div class="notes-float" id="notes-float">
  <div class="notes-float-header" id="notes-float-header">
    <span><i class="fas fa-note-sticky"></i> Trainee Notes</span>
    <button type="button" class="notes-float-close" id="notes-float-close"><i class="fas fa-times"></i></button>
  </div>
  <div class="notes-float-body">
    <textarea id="notes-float-textarea" placeholder="Notes for this trainee..."></textarea>
  </div>
</div>

<!-- Floating Announcement Preview — read-only -->
<div class="notes-float" id="announcement-float">
  <div class="notes-float-header" id="announcement-float-header">
    <span><i class="fas fa-bullhorn"></i> Announcement Preview</span>
    <button type="button" class="notes-float-close" id="announcement-float-close"><i class="fas fa-times"></i></button>
  </div>
  <div class="notes-float-body">
    <div class="announcement-float-preview" id="announcement-float-preview"></div>
  </div>
</div>
<script src="sessionongoing.js"></script>

<?php include __DIR__ . '/../public/assets/version_badge.php'; ?>
</body>
</html>