<?php
session_start();
require_once '../login/cnn.php';
require_once __DIR__ . '/../public/assets/misc/role_display.php';

if (!isset($_SESSION['user'])) {
    header('Location: ../login/login.php');
    exit;
}

$user      = $_SESSION['user'];
$username  = htmlspecialchars($user['username'] ?? '');
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
    if (!$hasAvatar) {
        $stmt2 = mysqli_prepare($conn, "SELECT 1 FROM user_list WHERE user_id = ? AND LENGTH(user_avatar) > 0");
        mysqli_stmt_bind_param($stmt2, "s", $staffId);
        mysqli_stmt_execute($stmt2);
        mysqli_stmt_store_result($stmt2);
        $hasAvatar = mysqli_stmt_num_rows($stmt2) > 0;
    }
}

define('PAGE_SIZE', 7);
$res = mysqli_query($conn, "SELECT notif_id, category, title, description, posted_at FROM notifications ORDER BY posted_at DESC LIMIT " . PAGE_SIZE);
$notifications = [];
while ($r = mysqli_fetch_assoc($res)) $notifications[] = $r;

$totalCountRes = mysqli_query($conn, "SELECT COUNT(*) AS c FROM notifications");
$totalCount = (int)(mysqli_fetch_assoc($totalCountRes)['c'] ?? 0);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
    <title>YSS – Notifications</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="notifications.css?v=<?= filemtime(__DIR__ . '/notifications.css') ?>"/>
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
        <button type="button" class="back-btn" id="back-btn"><i class="fas fa-arrow-left"></i> Back</button>
        <button class="profile-btn" id="profile-btn" aria-label="Profile menu">
            <div class="avatar">
                <?php if ($hasAvatar): ?>
                    <img src="../modules/profiles/avatar.php?id=<?= htmlspecialchars($staffId) ?>"
                        alt="Avatar"
                        style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                <?php else: ?>
                    <i class="fas fa-user"></i>
                <?php endif; ?>
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
                        <img src="../modules/profiles/avatar.php?id=<?= htmlspecialchars($staffId) ?>"
                            alt="Avatar"
                            style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                    <?php else: ?>
                        <i class="fas fa-user"></i>
                    <?php endif; ?>
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

<main class="notif-main">
    <h1 class="notif-page-title">Notifications</h1>

    <div class="notif-timeline" id="notif-timeline">
        <!-- rows injected below for the initial page, then appended by JS on "Load more" -->
    </div>

    <div class="notif-loadmore-wrap">
        <button type="button" class="notif-loadmore-btn" id="notif-loadmore-btn">Load more notifications</button>
        <div class="notif-empty" id="notif-empty" style="display:none;">No more notifications.</div>
    </div>
</main>

<script>
const INITIAL_NOTIFICATIONS = <?= json_encode($notifications, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
const TOTAL_NOTIF_COUNT = <?= (int)$totalCount ?>;
const PAGE_SIZE = <?= PAGE_SIZE ?>;
</script>
<script src="notifications.js?v=<?= filemtime(__DIR__ . '/notifications.js') ?>"></script>
<script src="../public/assets/avatar-cache.js"></script>
</body>
</html>