<?php
session_start();
require_once '../login/cnn.php';

if (!isset($_SESSION['user'])) {
    header('Location: ../login/login.php');
    exit;
}

// Pick a specific session via ?session_id=, or fall back to the most recently started one.
$sessionId = (int)($_GET['session_id'] ?? 0);
if ($sessionId) {
    $stmt = mysqli_prepare($conn, "SELECT * FROM session_ongoing WHERE session_id = ?");
    mysqli_stmt_bind_param($stmt, "i", $sessionId);
} else {
    $stmt = mysqli_prepare($conn, "SELECT * FROM session_ongoing ORDER BY started_at DESC LIMIT 1");
}
mysqli_stmt_execute($stmt);
$session = mysqli_stmt_get_result($stmt)->fetch_assoc();

$completedRows = [];
if ($session && !empty($session['live_state'])) {
    $live = json_decode($session['live_state'], true);
    $completedRows = $live['completedRows'] ?? [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>YSS – Active Session</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
<link rel="stylesheet" href="active.css?v=<?= filemtime(__DIR__ . '/active.css') ?>"/>
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
  <a href="../dashboard/dashboard.php" class="back-btn"><i class="fas fa-arrow-left"></i> Dashboard</a>
</header>

<main>
  <div class="session-head">
    <div>
      <div class="session-title">Session #<?= $session ? (int)$session['session_id'] : '—' ?> — <?= htmlspecialchars($session['host'] ?? '') ?></div>
      <div class="session-sub">Public view · read-only — trainee progress only</div>
    </div>
  </div>
<?php if (!$session): ?>
  <section class="panel">
    <div class="empty-state"><i class="fas fa-circle-pause"></i> No session is currently active.</div>
  </section>
<?php else: ?>
  <section class="panel">
    <div class="panel-title">Trainees Panel</div>
    <div class="table-wrap">
      <table class="public-table" id="public-table">
        <thead>
          <tr><th>Slot</th><th>Trainee Discord</th><th>Roblox</th><th>Zone</th><th>Trainer</th><th>Completed</th></tr>
        </thead>
        <tbody id="public-rows">
          <?php for ($t = 1; $t <= 10; $t++):
              $discord = $session["trainee_{$t}_discord"] ?? '';
              if (!$discord) continue;
              $done = !empty($completedRows[$t - 1]) || !empty($completedRows[$t]);
          ?>
            <tr>
              <td><?= $t ?></td>
              <td><?= htmlspecialchars($discord) ?></td>
              <td><?= htmlspecialchars($session["trainee_{$t}_name"] ?? '') ?></td>
              <td><?= htmlspecialchars($session["trainee_{$t}_zone"] ?? '—') ?></td>
              <td><?= htmlspecialchars($session["trainee_{$t}_trainer_name"] ?? '—') ?></td>
              <td class="chk-cell"><?= $done ? '<i class="fas fa-check-circle done"></i>' : '<i class="fas fa-circle"></i>' ?></td>
            </tr>
          <?php endfor; ?>
        </tbody>
      </table>
    </div>
  </section>
<?php endif; ?>
</main>

<script>
const SESSION_ID = <?= $session ? (int)$session['session_id'] : 'null' ?>;
</script>
<script src="active.js?v=<?= filemtime(__DIR__ . '/active.js') ?>"></script>
</body>
</html>