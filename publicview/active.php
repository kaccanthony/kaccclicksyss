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
<script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
<link rel="stylesheet" href="active.css?v=<?= filemtime(__DIR__ . '/active.css') ?>"/>
</head>
<body>
<div id="bg"></div>

<header class="topbar">
  <span class="app-name">YSS — Active Session <?= $session ? '#' . (int)$session['session_id'] : '' ?></span>
  <a href="../dashboard/dashboard.php" class="back-btn"><i class="fas fa-arrow-left"></i> Dashboard</a>
</header>

<main>
<?php if (!$session): ?>
  <div class="empty-state"><i class="fas fa-circle-pause"></i> No session is currently active.</div>
<?php else: ?>
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
<?php endif; ?>
</main>

<script>
const SESSION_ID = <?= $session ? (int)$session['session_id'] : 'null' ?>;
</script>
<script src="active.js?v=<?= filemtime(__DIR__ . '/active.js') ?>"></script>
</body>
</html>