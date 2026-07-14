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
$role = htmlspecialchars(formatRoleDisplay($user['role'] ?? '', (int)($user['perm_level'] ?? 0)));
$staffId   = $user['id'] ?? '';

$hasAvatar = false;
if ($staffId) {
    $stmt = mysqli_prepare($conn, "SELECT 1 FROM staff_list WHERE staff_id = ? AND LENGTH(staff_avatar) > 0");
    mysqli_stmt_bind_param($stmt, "s", $staffId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    $hasAvatar = mysqli_stmt_num_rows($stmt) > 0;
}

// ── Rank display order + per-row layout + gradient colors ──
// "suffix" flags (staff_host_authorized / staff_event_authorized) don't exist in
// staff_list yet — code below checks for them defensively with ?? 0, so nothing
// breaks today and the Head Staff -H/-E/-B suffix just switches on automatically
// once those columns get added.
$groupConfig = [
    'Operations Manager'   => ['label' => 'Operations Managers',  'perRow' => 0, 'colors' => ['#c631eb', '#cf8af6']],
    'Community Manager'    => ['label' => 'Community Managers',   'perRow' => 0, 'colors' => ['#c631eb', '#cf8af6']],
    'Head Staff'           => ['label' => 'Head Staff',           'perRow' => 3, 'colors' => ['#3e89eb', '#6abfe4']],
    'Host Authorized'      => ['label' => 'Host Authorized',      'perRow' => 3, 'colors' => ['#4CD964', '#8CE7A0'], 'comingSoon' => true],
    'Co-Host Authorized'   => ['label' => 'Co-Host Authorized',   'perRow' => 4, 'colors' => ['#FFDE34', '#FFF0A0']],
    'Assistant Authorized' => ['label' => 'Assistant Authorized', 'perRow' => 4, 'colors' => ['#FF7F52', '#FFB199']],
    'Event Authorized'     => ['label' => 'Event Authorized',     'perRow' => 3, 'colors' => ['#5DADEC', '#A8D4F5'], 'comingSoon' => true],
];
$rankOrder = array_keys($groupConfig);

// Decides the AOS animation for a card based on where it sits in its own row:
// odd row size → sides fade in from their edge, dead center zooms in.
// even row size → first half fades from the left, second half fades from the right.
function aosForPosition(int $pos, int $rowSize): string {
    if ($rowSize <= 1) return 'fade-up';
    if ($rowSize % 2 === 1) {
        $mid = intdiv($rowSize, 2);
        if ($pos < $mid) return 'fade-right';
        if ($pos > $mid) return 'fade-left';
        return 'zoom-in';
    }
    return $pos < $rowSize / 2 ? 'fade-right' : 'fade-left';
}

$staffByRank = [];
$resStaff = mysqli_query($conn, "SELECT * FROM staff_list WHERE staff_rank IN ('" . implode("','", array_map('mysqli_real_escape_string', array_fill(0, count($rankOrder), $conn), $rankOrder)) . "') ORDER BY staff_display_name ASC");
// (escaping done per-value above; array_fill trick just repeats $conn for array_map's second arg)
while ($r = mysqli_fetch_assoc($resStaff)) {
    $staffByRank[$r['staff_rank']][] = $r;
}

function headStaffSuffix(array $r): string {
    $host  = !empty($r['staff_host_authorized']);
    $event = !empty($r['staff_event_authorized']);
    if ($host && $event) return ' - B';
    if ($host)           return ' - H';
    if ($event)          return ' - E';
    return '';
}

// ── Individual member permalink (pretty URL via .htaccess: /staff/DiscordName) ──
$viewingMember = null;
if (isset($_GET['member']) && $_GET['member'] !== '') {
    $wanted = trim($_GET['member']);
    $stmtM = mysqli_prepare($conn, "SELECT * FROM staff_list WHERE LOWER(TRIM(staff_display_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(staff_name)) = LOWER(TRIM(?)) LIMIT 1");
    mysqli_stmt_bind_param($stmtM, "ss", $wanted, $wanted);
    mysqli_stmt_execute($stmtM);
    $viewingMember = mysqli_fetch_assoc(mysqli_stmt_get_result($stmtM));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
<title>YSS – Staff Overview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
<link rel="stylesheet" href="staff.css?v=<?= filemtime(__DIR__ . '/staff.css') ?>"/>
<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
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
            <a href="../notifications/notifications.php" class="popup-item"><i class="fas fa-bell"></i> Notifications</a>
            <a href="../settings/settings.php" class="popup-item"><i class="fas fa-cog"></i> Settings</a>
            <a href="../dashboard/dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-sign-out-alt"></i> Log out</a>
        </div>
    </div>
</header>

<main class="main">
<?php if ($viewingMember): ?>
    <!-- ── Temporary individual member view (stats not implemented yet) ── -->
    <a href="/staff/staff.php" class="back-btn" style="margin-bottom:24px;display:inline-flex;"><i class="fas fa-arrow-left"></i> Back to Staff Overview</a>
    <div class="member-detail-card">
        <div class="member-detail-avatar">
            <?php if (!empty($viewingMember['staff_avatar'])): ?>
                <img src="../modules/profiles/avatar.php?id=<?= htmlspecialchars($viewingMember['staff_id']) ?>" alt=""/>
            <?php else: ?>
                <i class="fas fa-user"></i>
            <?php endif; ?>
        </div>
        <div class="member-detail-name"><?= htmlspecialchars($viewingMember['staff_display_name'] ?: $viewingMember['staff_name']) ?></div>
        <div class="member-detail-rank"><?= htmlspecialchars($viewingMember['staff_rank']) ?></div>
        <div class="member-detail-soon"><i class="fas fa-chart-line"></i> Session statistics coming soon.</div>
    </div>
<?php else: ?>
    <div class="section-label">Staff Overview</div>
    <p class="section-sub">Everyone currently on the roster — tap a card to view their profile.</p>

    <?php foreach ($rankOrder as $rankKey):
        $cfg = $groupConfig[$rankKey];
        $members = $staffByRank[$rankKey] ?? [];
        if (empty($members) && empty($cfg['comingSoon'])) continue; // skip empty real groups silently
        $rowClass = $cfg['perRow'] === 0 ? 'staff-row' : "staff-grid staff-grid-{$cfg['perRow']}";
    ?>
    <section class="staff-section">
        <div class="staff-section-head">
            <span class="staff-section-title"><?= htmlspecialchars($cfg['label']) ?></span>
            <span class="staff-section-count"><?= count($members) ?></span>
        </div>

        <?php if (!empty($cfg['comingSoon'])): ?>
            <div class="staff-coming-soon"><i class="fas fa-hourglass-half"></i> Not yet implemented on our end.</div>
        <?php elseif (empty($members)): ?>
            <div class="staff-coming-soon"><i class="fas fa-user-slash"></i> No one currently holds this rank.</div>
        <?php else: ?>
        <div class="<?= $rowClass ?>">
            <?php
            $rowSize = $cfg['perRow'] === 0 ? count($members) : $cfg['perRow'];
            foreach ($members as $i => $m):
                $name = $m['staff_display_name'] ?: $m['staff_name'];
                $bio  = $m['staff_bio'] ?? '';
                $suffix = $rankKey === 'Head Staff' ? headStaffSuffix($m) : '';
                $hasAv = !empty($m['staff_avatar']);
                $posInRow = $rowSize > 0 ? $i % $rowSize : 0;
                $aosAnim = aosForPosition($posInRow, $rowSize);
                $aosDelay = $posInRow * 80;
            ?>
            <a href="/staff/<?= rawurlencode($name) ?>"
               class="staff-card"
               data-aos="<?= $aosAnim ?>"
               data-aos-delay="<?= $aosDelay ?>"
               data-aos-duration="600"
               style="--c1:<?= $cfg['colors'][0] ?>;--c2:<?= $cfg['colors'][1] ?>;">
                <div class="staff-card-img" style="<?= $hasAv ? "background-image:url('../modules/profiles/avatar.php?id=" . htmlspecialchars($m['staff_id']) . "')" : '' ?>">
                    <?php if (!$hasAv): ?><i class="fas fa-user staff-card-noimg"></i><?php endif; ?>
                </div>
                <div class="staff-card-overlay"></div>
                <div class="staff-card-content">
                    <div class="staff-card-name"><?= htmlspecialchars($name) ?></div>
                    <?php if ($bio): ?><div class="staff-card-bio"><?= htmlspecialchars($bio) ?></div><?php endif; ?>
                    <div class="staff-card-bottom">
                        <span class="staff-card-role"><i class="fas fa-id-badge"></i> <?= htmlspecialchars($cfg['label']) . $suffix ?></span>
                        <span class="staff-card-view">View</span>
                    </div>
                </div>
            </a>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </section>
    <?php endforeach; ?>
<?php endif; ?>
</main>

<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
<script>AOS.init();</script>
<script src="staff.js?v=<?= filemtime(__DIR__ . '/staff.js') ?>"></script>
<?php include __DIR__ . '/../public/assets/version_badge.php'; ?>
<script src="../public/assets/js/avatar-cache.js"></script>
</body>
</html>