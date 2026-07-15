<?php
// past.php
session_start();
require_once '../login/cnn.php';
require_once __DIR__ . '/../public/assets/role_display.php';

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
$permLevel = (int)($user['perm_level'] ?? 0);
$role      = htmlspecialchars(formatRoleDisplay($user['role'] ?? '', $permLevel));
$staffId   = $user['id'] ?? '';

$hasAvatar = false;
if ($staffId) {
    $stmt = mysqli_prepare($conn, "SELECT 1 FROM staff_list WHERE staff_id = ? AND LENGTH(staff_avatar) > 0");
    mysqli_stmt_bind_param($stmt, "s", $staffId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    $hasAvatar = mysqli_stmt_num_rows($stmt) > 0;
}

// Discord ID → display name, so trainer_id resolves to something readable
$staffDirectory = [];
$resStaff = mysqli_query($conn, "SELECT staff_id, staff_display_name, staff_name FROM staff_list");
while ($r = mysqli_fetch_assoc($resStaff)) {
    $staffDirectory[$r['staff_id']] = $r['staff_display_name'] ?: $r['staff_name'];
}

// ── Every concluded/archived session, most recent first ──
// Only the 5 session_post_logs columns you asked for, joined against session_staff_logs
// for the host/co-host/assistant roster (session_ongoing itself is gone by this point).
$sessions = [];
$sql = "SELECT p.session_id, p.session_name, p.session_desc, p.session_status, p.session_date,
               s.host, s.cohost_1, s.cohost_2, s.cohost_3, s.`cohost_4/supervisor`,
               s.assistant_1, s.assistant_2, s.assistant_3, s.assistant_4
        FROM session_post_logs p
        LEFT JOIN session_staff_logs s ON s.session_id = p.session_id
        ORDER BY p.session_date DESC, p.session_id DESC";
$res = mysqli_query($conn, $sql);

while ($row = mysqli_fetch_assoc($res)) {
    $sid = (int)$row['session_id'];

    $cohostFilled = 0;
    foreach (['cohost_1', 'cohost_2', 'cohost_3'] as $c) if (!empty($row[$c])) $cohostFilled++;
    $assistFilled = 0;
    foreach (['assistant_1', 'assistant_2', 'assistant_3', 'assistant_4'] as $a) if (!empty($row[$a])) $assistFilled++;

    // Only trainees who actually attended (trainee_attendance = 1) count as "trained" —
    // matches unallocated trainees just as well, since this just filters session_full_logs
    // by session_id + attendance, with no dependency on how they were originally slotted.
    $trainees = [];
    $stmtT = mysqli_prepare($conn, "SELECT trainee_roblox, trainee_zone, trainer_id FROM session_full_logs WHERE session_id = ? AND trainee_attendance = 1");
    mysqli_stmt_bind_param($stmtT, "i", $sid);
    mysqli_stmt_execute($stmtT);
    $resT = mysqli_stmt_get_result($stmtT);
    while ($t = mysqli_fetch_assoc($resT)) {
        $trainees[] = [
            'name'    => $t['trainee_roblox'],
            'zone'    => $t['trainee_zone'],
            'trainer' => $staffDirectory[$t['trainer_id']] ?? ($t['trainer_id'] ?: '—'),
        ];
    }

    $row['cohost_filled']   = $cohostFilled;
    $row['cohost_total']    = 3;
    $row['supervisor_name'] = $row['cohost_4/supervisor'] ?? '';
    $row['assistant_filled']= $assistFilled;
    $row['assistant_total'] = 4;
    $row['trainees_trained']= $trainees;

    $sessions[] = $row;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
    <title>YSS – Past Sessions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="past.css?v=<?= filemtime(__DIR__ . '/past.css') ?>"/>
</head>
<body>
<div id="bg"></div>

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
            <a href="../dashboard/notifications.php" class="popup-item"><i class="fas fa-bell"></i> Notifications</a>
            <a href="../settings/settings.php" class="popup-item"><i class="fas fa-cog"></i> Settings</a>
            <a href="../dashboard/dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-sign-out-alt"></i> Log out</a>
        </div>
    </div>
</header>

<main class="main">
    <div class="page-header">
        <div>
            <div class="section-eyebrow">Session Management</div>
            <h1 class="section-title">Past Sessions</h1>
            <p class="section-sub">Every concluded or cancelled session on record</p>
        </div>
        <div class="view-switcher" id="view-switcher">
            <button type="button" class="view-btn active" data-view="grid" title="Grid view"><i class="fas fa-table-cells-large"></i> Grid</button>
            <button type="button" class="view-btn" data-view="focus" title="Focus view"><i class="fas fa-list-check"></i> Focus</button>
            <button type="button" class="view-btn" data-view="list" title="List view"><i class="fas fa-bars"></i> List</button>
            <button type="button" class="view-btn" data-view="card" title="Card view"><i class="fas fa-id-card"></i> Card</button>
        </div>
    </div>

    <div id="view-root"><!-- populated entirely by JS --></div>
</main>

<script>
const SESSIONS_DATA = <?= json_encode($sessions, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
</script>
<script src="past.js?v=<?= filemtime(__DIR__ . '/past.js') ?>"></script>
<script src="../public/assets/avatar-cache.js"></script>
</body>
</html>