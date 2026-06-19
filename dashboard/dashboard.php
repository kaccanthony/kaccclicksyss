<?php
session_start();

// ── Logout ──
if (isset($_GET['logout'])) {
    session_destroy();
    setcookie('remember_token', '', time() - 3600, '/', '', true, true);
    header('Location: ../login/login.php');
    exit;
}

if (!isset($_SESSION['user'])) {
    header('Location: ../login/login.php');
    exit;
}

$user     = $_SESSION['user'];
$username = htmlspecialchars($user['username']);
$role     = htmlspecialchars($user['role'] ?? '');
$permLevel = (int)($user['perm_level'] ?? 0);
$roblox    = htmlspecialchars($user['roblox_name'] ?? '');
$avatar = htmlspecialchars($user['avatar'] ?? '');

if (empty($user['role'])) {
    $_SESSION['error'] = 'Your account has no role assigned. Contact an admin.';
    header('Location: ../login/login.php');
    exit;
}

$allCards = [
    'booking'       => ['label' => 'Manage Session(s)', 'sub' => 'Manager', 'icon' => '../icons/OM.png',   'href' => 'booking.php'], // session booking
    'setup'         => ['label' => 'Session Setup'  ,  'sub' => 'Head-Staff' , 'icon' => '../icons/HS.png',          'href' => 'setup.php'], // session setup
    'panel_host'    => ['label' => 'Session Panel',   'sub' => 'Host',   'icon' => '../icons/HS.png',            'href' => 'panel_host.php'], // session panel host quick access
    'panel_cohost'  => ['label' => 'Session Panel',   'sub' => 'Co-Host','icon' => '../icons/ST.png',      'href' => 'panel_cohost.php'], // session panel co-host quick access
    'panel_asst'    => ['label' => 'Session Panel',   'sub' => 'Assistant','icon' => '../icons/ST.png',        'href' => 'panel_asst.php'], // session panel assistant quick access
    'active'        => ['label' => 'Active Session',                      'icon' => '../icons/Inprogress.png',      'href' => 'active.php'], // active session
    'upcoming'      => ['label' => 'Upcoming Sessions',                   'icon' => 'fa-clock',           'href' => 'upcoming.php'], // upcoming sessions
    'past'          => ['label' => 'Past Sessions',                       'icon' => 'fa-rectangle-list',  'href' => 'past.php'], // past sessions
    'staff'         => ['label' => 'Staff Overview',                      'icon' => 'fa-users',           'href' => 'staff.php'], // staff overview 
];

$roleCards = [
    'Operations Manager'  => ['booking','setup','panel_host','panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Community Manager'   => ['booking','setup','panel_host','panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Head Staff'     => ['setup','panel_host','panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Co-Host Authorized'  => ['panel_cohost','panel_asst','active','upcoming','past','staff'],
    'Assistant Authorized'=> ['panel_asst','active','upcoming','past','staff'],
];

$cards = [];
foreach (($roleCards[$role] ?? []) as $key) {
    if (isset($allCards[$key])) $cards[] = $allCards[$key];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="../icons/YSS Logo.png">
    <title>YSS – Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="dashboard.css" />
</head>
<body>

<!-- ── Blurred background ── -->
<div id="bg"></div>

<!-- ── Top bar ── -->
<header class="topbar">
    <!-- Logo + pulse -->
    <div class="logo-wrap">
        <div class="pulse-ring"></div>
        <div class="pulse-ring ring2"></div>
        <img src="../icons/YSS Logo.png" alt="YSS Logo" class="logo-img" />
    </div>
    <span class="app-name">YSS Session Manager</span>

    <div class="topbar-right">
        <!-- Profile button -->
        <button class="profile-btn" id="profile-btn" aria-label="Profile menu">
            <div class="avatar">
                <?php if ($avatar): ?>
                    <img src="<?= $avatar ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
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

        <!-- Slide-down popup -->
        <div class="profile-popup" id="profile-popup">
            <div class="popup-header">
                <div class="popup-avatar">
                    <?php if ($avatar): ?>
                        <img src="<?= $avatar ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                    <?php else: ?>
                        <i class="fas fa-user"></i> 
                    <?php endif; ?>
                </div>
                <div>
                    <div class="popup-name"><?= $username ?></div>
                    <div class="popup-role"><?= $role ?></div>
                </div>
            </div>
            <div class="popup-section-label">Assigned Sessions</div>
            <div class="popup-sessions" id="popup-sessions">
                <span class="session-pill"><i class="fas fa-circle-dot"></i> No active sessions</span>
            </div>
            <div class="popup-divider"></div>
            <a href="settings.php" class="popup-item"><i class="fas fa-gear"></i> Settings</a>
            <a href="dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-right-from-bracket"></i> Log out</a>
        </div>
    </div>
</header>

<!-- ── Main ── -->
<main class="main">
    <div class="section-label">Dashboard</div>
    <p class="section-sub">Welcome back, <?= $username ?>. Here's what you have access to.</p>

    <div class="bento-grid" id="bento-grid">
        <?php foreach ($cards as $i => $card): ?>
        <a href="<?= htmlspecialchars($card['href']) ?>" class="bento-card" style="--i:<?= $i ?>">
            <div class="bento-icon">
                <?php if (str_starts_with($card['icon'], '../icons/')): ?>
                    <img src="<?= htmlspecialchars($card['icon']) ?>" alt="<?= htmlspecialchars($card['label']) ?>" style="width:32px;height:32px;object-fit:contain;" />
                <?php else: ?>
                    <i class="fas <?= htmlspecialchars($card['icon']) ?>"></i>
                <?php endif; ?>
            </div>
            <div class="bento-text">
                <span class="bento-label"><?= htmlspecialchars($card['label']) ?></span>
                <?php if (!empty($card['sub'])): ?>
                    <span class="bento-sub"><?= htmlspecialchars($card['sub']) ?> Authorized</span>
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