<?php
session_start();
require_once '../login/cnn.php'; // adjust to your actual path

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

if (empty($user['role'])) {
    $_SESSION['error'] = 'Your account has no role assigned. Contact an admin.';
    header('Location: /login/login.php');
    exit;
}

$allCards = [
    'booking'      => ['label' => 'Manage Session(s)',   'sub' => 'Manager & Head Staff',               'icon' => '/public/assets/images/icons/OM.png',          'href' => '../managesession/managesession.php'],
    'setup'        => ['label' => 'Session Setup',       'sub' => 'Head-Staff',             'icon' => '/public/assets/images/icons/HS.png',          'href' => 'setup.php'],
    'panel_host'   => ['label' => 'Session Panel',       'sub' => 'Host Authorized',        'icon' => '/public/assets/images/icons/HS.png',          'href' => 'panel_host.php'],
    'panel_cohost' => ['label' => 'Session Panel',       'sub' => 'Co-Host Authorized',     'icon' => '/public/assets/images/icons/ST.png',          'href' => 'panel_cohost.php'],
    'panel_asst'   => ['label' => 'Session Panel',       'sub' => 'Assistant Authorized',   'icon' => '/public/assets/images/icons/ST.png',          'href' => 'panel_asst.php'],
    'active'       => ['label' => 'Active Session',      'sub' => '',                       'icon' => '/public/assets/images/icons/Inprogress.png',  'href' => 'active.php'],
    'upcoming'     => ['label' => 'Upcoming Sessions',   'sub' => '',                       'icon' => 'fa-clock',                                    'href' => 'upcoming.php'],
    'past'         => ['label' => 'Past Sessions',       'sub' => '',                       'icon' => 'fa-rectangle-list',                           'href' => 'past.php'],
    'staff'        => ['label' => 'Staff Overview',      'sub' => '',                       'icon' => 'fa-users',                                    'href' => 'staff.php'],
];

$roleCards = [
    'Operations Manager'   => ['booking','setup','panel_host','panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Community Manager'    => ['booking','setup','panel_host','panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Head Staff'           => ['booking', 'setup','panel_host','panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Co-Host Authorized'   => ['panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Assistant Authorized' => ['panel_asst','active','upcoming','past','staff'],
];

$cards = [];
foreach (($roleCards[$role] ?? []) as $key) {
    if (isset($allCards[$key])) $cards[] = $allCards[$key];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png">
    <title>YSS – Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="dashboard.css"/>
</head>
<body>
<div id="bg"></div>

<!-- ── Topbar ── -->
<?php include '../modules/header/header.php'; ?>

<main class="main">
    <div class="section-label">Dashboard</div>
    <p class="section-sub">Welcome back, <?= $username ?>. Here's what you have access to.</p>

    <div class="bento-grid" id="bento-grid">
        <?php foreach ($cards as $i => $card): ?>
        <a href="<?= htmlspecialchars($card['href']) ?>" class="bento-card" style="--i:<?= $i ?>">
            <div class="bento-icon">
                <?php if (str_starts_with($card['icon'], '/')): ?>
                    <img src="<?= htmlspecialchars($card['icon']) ?>"
                         alt="<?= htmlspecialchars($card['label']) ?>"
                         style="width:32px;height:32px;object-fit:contain;"/>
                <?php else: ?>
                    <i class="fas <?= htmlspecialchars($card['icon']) ?>"></i>
                <?php endif; ?>
            </div>
            <div class="bento-text">
                <span class="bento-label"><?= htmlspecialchars($card['label']) ?></span>
                <?php if (!empty($card['sub'])): ?>
                    <span class="bento-sub"><?= htmlspecialchars($card['sub']) ?></span>
                <?php endif; ?>
            </div>
            <i class="fas fa-arrow-right bento-arrow"></i>
        </a>
        <?php endforeach; ?>

        <?php if (empty($cards)): ?>
        <div class="bento-empty">
            <i class="fas fa-lock"></i>
            <p>No panels assigned to your role yet.</p>
        </div>
        <?php endif; ?>
    </div>
</main>

<script src="dashboard.js"></script>
</body>
</html>