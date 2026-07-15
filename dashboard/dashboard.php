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
require_once __DIR__ . '/../public/assets/misc/role_display.php';
$rawRole   = $user['role'] ?? '';                                        // untouched DB value — used for permission logic
$role      = htmlspecialchars(formatRoleDisplay($rawRole, (int)($user['perm_level'] ?? 0))); // formatted — used for on-screen display only
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

// ── Assigned Sessions (host / co-host / assistant / additional staff) ──
$myDisplayName = '';
if ($staffId) {
    $stmtMe = mysqli_prepare($conn, "SELECT staff_display_name, staff_name FROM staff_list WHERE staff_id = ?");
    mysqli_stmt_bind_param($stmtMe, "s", $staffId);
    mysqli_stmt_execute($stmtMe);
    if ($rowMe = mysqli_fetch_assoc(mysqli_stmt_get_result($stmtMe))) {
        $myDisplayName = $rowMe['staff_display_name'] ?: $rowMe['staff_name'];
    }
}

$assignedSessions = [];
if ($myDisplayName) {
    $bst = new DateTimeZone('Europe/London');
    $nowBST = new DateTime('now', $bst);

    $stmtAssigned = mysqli_prepare($conn, "SELECT session_id, session_name, session_date, session_time,
            host, co_host1, co_host2, co_host3, `co_host4/supervisor`,
            assistant_1, assistant_2, assistant_3, assistant_4, additional_staff
        FROM session_upcoming
        WHERE session_status IN ('Booked','Scheduled')
        AND session_booked = 1
        AND (session_date > ? OR (session_date = ? AND session_time >= ?))
        AND (host = ? OR co_host1 = ? OR co_host2 = ? OR co_host3 = ? OR `co_host4/supervisor` = ?
        OR assistant_1 = ? OR assistant_2 = ? OR assistant_3 = ? OR assistant_4 = ?
        OR additional_staff LIKE ?)
        ORDER BY session_date ASC, session_time ASC
        LIMIT 8");
    $todayBST = $nowBST->format('Y-m-d');
    $nowTimeBST = $nowBST->format('H:i:s');
    $likeMe = '%' . $myDisplayName . '%';
    mysqli_stmt_bind_param($stmtAssigned, "sssssssssssss",
        $todayBST, $todayBST, $nowTimeBST,
        $myDisplayName, $myDisplayName, $myDisplayName, $myDisplayName, $myDisplayName,
        $myDisplayName, $myDisplayName, $myDisplayName, $myDisplayName, $likeMe
    );
    mysqli_stmt_execute($stmtAssigned);
    $resAssigned = mysqli_stmt_get_result($stmtAssigned);
    while ($row = mysqli_fetch_assoc($resAssigned)) {
        $roleLabel = 'Additional Staff';
        if ($row['host'] === $myDisplayName)                         $roleLabel = 'Host';
        elseif ($row['co_host1'] === $myDisplayName)                 $roleLabel = 'CH 1';
        elseif ($row['co_host2'] === $myDisplayName)                 $roleLabel = 'CH 2';
        elseif ($row['co_host3'] === $myDisplayName)                 $roleLabel = 'CH 3';
        elseif ($row['co_host4/supervisor'] === $myDisplayName)      $roleLabel = 'CH 4 / SV';
        elseif ($row['assistant_1'] === $myDisplayName)              $roleLabel = 'AST 1';
        elseif ($row['assistant_2'] === $myDisplayName)              $roleLabel = 'AST 2';
        elseif ($row['assistant_3'] === $myDisplayName)              $roleLabel = 'AST 3';
        elseif ($row['assistant_4'] === $myDisplayName)              $roleLabel = 'AST 4';

        $row['role_label'] = $roleLabel;
        $assignedSessions[] = $row;
    }
}

// Only STAFF accounts are required to have a role. Regular self-registered users
// (session-goers) are expected to have an empty role — don't bounce them for that.
if (!empty($user['is_staff']) && empty($user['role'])) {
    $_SESSION['error'] = 'Your account has no role assigned. Contact an admin.';
    header('Location: /login/login.php');
    exit;
}

// ── Find a currently-live session this user is actually part of, if any ──
$myLiveSessionId = null;
if ($myDisplayName) {
    $stmtLive = mysqli_prepare($conn, "SELECT session_id FROM session_ongoing
    WHERE LOWER(TRIM(host)) = LOWER(TRIM(?))
       OR LOWER(TRIM(co_host1)) = LOWER(TRIM(?))
       OR LOWER(TRIM(co_host2)) = LOWER(TRIM(?))
       OR LOWER(TRIM(co_host3)) = LOWER(TRIM(?))
       OR LOWER(TRIM(`co_host4/supervisor`)) = LOWER(TRIM(?))
       OR LOWER(TRIM(assistant_1)) = LOWER(TRIM(?))
       OR LOWER(TRIM(assistant_2)) = LOWER(TRIM(?))
       OR LOWER(TRIM(assistant_3)) = LOWER(TRIM(?))
       OR LOWER(TRIM(assistant_4)) = LOWER(TRIM(?))
       OR LOWER(additional_staff) LIKE LOWER(?)
    LIMIT 1");
$likeMeLive = '%' . $myDisplayName . '%';
mysqli_stmt_bind_param($stmtLive, "ssssssssss",
    $myDisplayName, $myDisplayName, $myDisplayName, $myDisplayName, $myDisplayName,
    $myDisplayName, $myDisplayName, $myDisplayName, $myDisplayName, $likeMeLive
);
    mysqli_stmt_execute($stmtLive);
    if ($rowLive = mysqli_fetch_assoc(mysqli_stmt_get_result($stmtLive))) {
        $myLiveSessionId = $rowLive['session_id'];
    }
}

$allCards = [
    'booking'      => ['label' => 'Manage Session(s)', 'sub' => 'Manager & Head Staff', 'icon' => '/public/assets/images/icons/OM.png', 'href' => '../managesession/managesession.php'],
    'setup'        => ['label' => 'Session Setup',     'sub' => 'Head-Staff',           'icon' => '/public/assets/images/icons/HS.png', 'href' => '../setupsesh/setupsesh.php'],
    'my_session'   => ['label' => 'Session Panel', 'sub' => 'All Staff (Manager, HS, ST) (Depending on your role)', 'icon' => '/public/assets/images/icons/ST.png', 'href' => '../sessionongoing/sessionongoing.php?session_id=' . $myLiveSessionId],
    'active'       => ['label' => 'Active Session',    'sub' => '', 'icon' => '/public/assets/images/icons/Inprogress.png', 'href' => '../publicview/active.php'],
    'upcoming'     => ['label' => 'Upcoming Sessions', 'sub' => '', 'icon' => 'fa-clock', 'href' => '../upcomingsesh/upcomingsesh.php'],
    'past'         => ['label' => 'Past Sessions',     'sub' => '', 'icon' => 'fa-fast-backward', 'href' => 'past.php'],
    'staff'        => ['label' => 'Staff Overview',    'sub' => '', 'icon' => 'fa-users', 'href' => '../staff/staff.php'],
    'manage_staff' => ['label' => 'Manage Staff', 'sub' => 'Manager & Admin', 'icon' => '/public/assets/images/icons/OM.png', 'href' => '../manager/managestaff.php'],
    'admin_panel'  => ['label' => 'Admin Panel', 'sub' => 'Admin only', 'icon' => 'fa-user-tie', 'href' => '../secret/admin.php'],
];

$roleCards = [
    'Operations Manager'   => ['booking','setup','my_session','active','upcoming','past','staff'],
    'Community Manager'    => ['booking','setup','my_session','active','upcoming','past','staff'],
    'Head Staff'           => ['booking','setup','my_session','active','upcoming','past','staff'],
    'Co-Host Authorized'   => ['my_session','active','upcoming','past','staff'],
    'Assistant Authorized' => ['my_session','active','upcoming','past','staff'],
    ''                     => ['active','upcoming','past'], // regular (non-staff) users
];

$cards = [];
foreach (($roleCards[$rawRole] ?? []) as $key) {
    if ($key === 'my_session' && !$myLiveSessionId) continue; // hide entirely when nothing to jump to
    if (isset($allCards[$key])) $cards[] = $allCards[$key];
}

// Permission-level gates (staff_list.staff_perm_level) rather than role-name lookups —
// Manager (15) and Admin (20) both qualify for Manage Staff; only Admin (20) gets Admin Panel.
if ($permLevel >= 15) $cards[] = $allCards['manage_staff'];
if ($permLevel >= 20) $cards[] = $allCards['admin_panel'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
    <title>YSS – Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="dashboard.css"/>
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
            <div class="popup-section-label">Assigned Sessions</div>
            <div class="popup-sessions" id="popup-sessions">
                <?php if (empty($assignedSessions)): ?>
                    <span class="session-pill"><i class="fas fa-circle-dot"></i> No active sessions</span>
                <?php else: ?>
                    <?php foreach ($assignedSessions as $as): ?>
                        <?php
                            $sessionDT = new DateTime($as['session_date'] . ' ' . $as['session_time'], new DateTimeZone('Europe/London'));
                        ?>
                        <span class="session-pill" title="<?= htmlspecialchars($as['session_name'] ?: ('Session #' . $as['session_id'])) ?>">
                            <i class="fas fa-circle-dot"></i>
                            <?= htmlspecialchars($sessionDT->format('M j, H:i')) ?> BST — <?= htmlspecialchars($as['role_label']) ?>
                        </span>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
            <div class="popup-divider"></div>
            <a href="notifications.php" class="popup-item"><i class="fas fa-bell"></i> Notifications</a>
            <a href="../settings/settings.php"      class="popup-item"><i class="fas fa-cog"></i> Settings</a>
            <a href="dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-sign-out-alt"></i> Log out</a>
        </div>
    </div>
</header>

<main class="main">
    <div class="section-label">Dashboard</div>
    <p class="section-sub">Welcome back, <?= $username ?>. Here's what you have access to.</p>

    <div class="bento-grid" id="bento-grid">
        <?php foreach ($cards as $i => $card): ?>
        <?php $tag = !empty($card['comingSoon']) ? 'div' : 'a'; ?>
        <<?= $tag ?> <?= $tag === 'a' ? 'href="' . htmlspecialchars($card['href']) . '"' : '' ?> class="bento-card<?= !empty($card['comingSoon']) ? ' bento-card-disabled' : '' ?>" style="--i:<?= $i ?>">
            <?php if (!empty($card['comingSoon'])): ?><span class="bento-ribbon">Coming Soon</span><?php endif; ?>
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
        </<?= $tag ?>>
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
<?php include __DIR__ . '/../public/assets/version_badge.php'; ?>
<script src="../public/assets/js/avatar-cache.js"></script>
</body>
</html>