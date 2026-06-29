
<?php
session_start();
require_once '../login/cnn.php';

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
$role      = htmlspecialchars($user['role'] ?? '');
$permLevel = (int)($user['perm_level'] ?? 0);
$staffId   = $user['id'] ?? '';   // ← define this

// Check if avatar exists in DB (don't store blob in session)
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
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
    <title>YSS – Setup Session</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="setupsesh.css"/>
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
                    <img src="../modules/profiles/avatar.php?id=<?= htmlspecialchars($staffId) ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
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
                        <img src="../modules/profiles/avatar.php?id=<?= htmlspecialchars($staffId) ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
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
<script src="setupsesh.js"></script>

</body>
</html>