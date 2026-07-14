<?php
// upcomingsesh.php
session_start();
require_once '../login/cnn.php';

$bst = new DateTimeZone('Europe/London');
$nowBST = new DateTime('now', $bst);

if (isset($_GET['logout'])) {
    session_destroy();
    setcookie('remember_token', '', time() - 3600, '/', '', true, true);
    header('Location: /login/login.php');
    exit;
}
if (!isset($_SESSION['user'])) {
    header('Location: /login/login.php');
    exit;
}

$user      = $_SESSION['user'];
$username  = htmlspecialchars($user['username']);
require_once __DIR__ . '/../public/assets/misc/role_display.php';
$role = htmlspecialchars(formatRoleDisplay($user['role'] ?? '', (int)($user['perm_level'] ?? 0)));
$staffId   = $user['id'] ?? '';
// No role restriction — open to any logged-in account (staff or, eventually, regular users).

$hasAvatar = false;
if ($staffId) {
    $stmt = mysqli_prepare($conn, "SELECT 1 FROM staff_list WHERE staff_id = ? AND LENGTH(staff_avatar) > 0");
    mysqli_stmt_bind_param($stmt, "s", $staffId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    $hasAvatar = mysqli_stmt_num_rows($stmt) > 0;
}

// ── Fetch every upcoming session from right now onward (BST wall-clock) — no past sessions ──
$todayBST   = $nowBST->format('Y-m-d');
$nowTimeBST = $nowBST->format('H:i:s');

$sessions = [];
$stmtS = mysqli_prepare($conn,
    "SELECT * FROM session_upcoming
     WHERE session_date > ? OR (session_date = ? AND session_time >= ?)
     ORDER BY session_date ASC, session_time ASC"
);
mysqli_stmt_bind_param($stmtS, "sss", $todayBST, $todayBST, $nowTimeBST);
mysqli_stmt_execute($stmtS);
$resS = mysqli_stmt_get_result($stmtS);

while ($row = mysqli_fetch_assoc($resS)) {
    $cohostFilled = 0;
    foreach (['co_host1', 'co_host2', 'co_host3'] as $c) {
        if (!empty($row[$c])) $cohostFilled++;
    }
    $assistFilled = 0;
    foreach (['assistant_1', 'assistant_2', 'assistant_3', 'assistant_4'] as $a) {
        if (!empty($row[$a])) $assistFilled++;
    }
    $traineeFilled = 0;
    for ($t = 1; $t <= 10; $t++) {
        if (!empty($row["trainee_{$t}_name"])) $traineeFilled++;
    }

    // Correct BST/GMT-aware instant for this session — DateTime handles the UK's DST
    // switch automatically, so the offset baked into this ISO string is always right.
    try {
        $sessDt = new DateTime($row['session_date'] . ' ' . $row['session_time'], $bst);
        $row['session_datetime_iso'] = $sessDt->format(DateTime::ATOM);
    } catch (Exception $e) {
        $row['session_datetime_iso'] = null;
    }

    $row['cohost_filled']    = $cohostFilled;
    $row['cohost_total']     = 3;
    $row['supervisor_name']  = $row['co_host4/supervisor'] ?? '';
    $row['assistant_filled'] = $assistFilled;
    $row['assistant_total']  = 4;
    $row['trainee_filled']   = $traineeFilled;
    $row['trainee_total']    = (int)($row['num_slots'] ?? 0);

    $sessions[] = $row;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
    <title>YSS – Upcoming Sessions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="upcomingsesh.css?v=<?= filemtime(__DIR__ . '/upcomingsesh.css') ?>"/>
</head>
<body>
<div id="bg"></div>

<!-- ── Topbar ── -->
<header class="topbar">
    <div class="logo-wrap">
        <div class="pulse-ring"></div>
        <div class="pulse-ring ring2"></div>
        <img src="/public/assets/images/YSS Logo.png" alt="YSS Logo" class="logo-img"/>
    </div>
    <span class="app-name">YSS Session Manager</span>
    <div class="topbar-right">
        <a href="../dashboard/dashboard.php" class="back-btn"><i class="fas fa-arrow-left"></i> Dashboard</a>
        <button class="profile-btn" id="profile-btn" aria-label="Profile menu">
            <div class="avatar">
                <?php if ($hasAvatar): ?>
                    <i class="fas fa-user avatar-fallback-icon"></i>
                    <img class="js-avatar" data-avatar-id="<?= htmlspecialchars($staffId) ?>" alt="Avatar" style="display:none;width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                <?php else: ?><i class="fas fa-user"></i><?php endif; ?>
            </div>
            <div class="profile-meta">
                <span class="profile-name"><?= $username ?></span>
                <span class="profile-role"><?= $role ?></span>
            </div>
            <i class="fas fa-chevron-down chev" id="chev"></i>
        </button>
        <div class="profile-popup" id="profile-popup">
            <div class="popup-header">
                <div class="popup-avatar">
                    <?php if ($hasAvatar): ?>
                        <i class="fas fa-user avatar-fallback-icon"></i>
                        <img class="js-avatar" data-avatar-id="<?= htmlspecialchars($staffId) ?>" alt="Avatar" style="display:none;width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                    <?php else: ?><i class="fas fa-user"></i><?php endif; ?>
                </div>
                <div>
                    <div class="popup-name"><?= $username ?></div>
                    <div class="popup-role"><?= $role ?></div>
                </div>
            </div>
            <div class="popup-divider"></div>
            <a href="notifications.php" class="popup-item"><i class="fas fa-bell"></i> Notifications</a>
            <a href="../settings/settings.php" class="popup-item"><i class="fas fa-cog"></i> Settings</a>
            <a href="../dashboard/dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-sign-out-alt"></i> Log out</a>
        </div>
    </div>
</header>

<!-- ── Main Layout ── -->
<main class="main">
    <div class="page-header">
        <div>
            <div class="section-eyebrow">Session Management</div>
            <h1 class="section-title">Upcoming Sessions</h1>
            <p class="section-sub">Every scheduled session from right now onward <span class="bst-badge">BST</span></p>
        </div>
        <div class="view-switcher" id="view-switcher">
            <button type="button" class="view-btn active" data-view="grid" title="Grid view"><i class="fas fa-table-cells-large"></i> Grid</button>
            <button type="button" class="view-btn" data-view="focus" title="Focus view"><i class="fas fa-list-check"></i> Focus</button>
            <button type="button" class="view-btn" data-view="list" title="List view"><i class="fas fa-bars"></i> List</button>
            <button type="button" class="view-btn" data-view="card" title="Card view"><i class="fas fa-id-card"></i> Card</button>
        </div>
    </div>

    <div id="view-root"><!-- populated entirely by JS, no reload on view switch --></div>
</main>

<script>
const SESSIONS_DATA = <?= json_encode($sessions, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
</script>
<script src="upcomingsesh.js?v=<?= filemtime(__DIR__ . '/upcomingsesh.js') ?>"></script>
<script src="../public/assets/avatar-cache.js"></script>
</body>
</html>