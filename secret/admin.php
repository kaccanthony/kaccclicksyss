<?php
// admin.php
session_start();
require_once '../login/cnn.php';
require_once __DIR__ . '/admin_tables.php';
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

if ($permLevel < 20) {
    header('Location: ../dashboard/dashboard.php');
    exit;
}

$hasAvatar = false;
if ($staffId) {
    $stmt = mysqli_prepare($conn, "SELECT 1 FROM staff_list WHERE staff_id = ? AND LENGTH(staff_avatar) > 0");
    mysqli_stmt_bind_param($stmt, "s", $staffId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    $hasAvatar = mysqli_stmt_num_rows($stmt) > 0;
}

$tableConfig = getTableConfig();

// Group boards for the sidebar, in a fixed display order
$groupOrder = ['Staff Management', 'Session Logs', 'Events', 'Admin Only'];
$groups = [];
foreach ($groupOrder as $g) $groups[$g] = [];
foreach ($tableConfig as $key => $cfg) {
    if (!empty($cfg['minLevel']) && $permLevel < $cfg['minLevel']) continue;
    $groups[$cfg['group']][$key] = $cfg;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png"/>
    <title>YSS – Manage Staff</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="admin.css?v=<?= filemtime(__DIR__ . '/admin.css') ?>"/>
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
            <a href="../notif/notifications.php" class="popup-item"><i class="fas fa-bell"></i> Notifications</a>
            <a href="../settings/settings.php" class="popup-item"><i class="fas fa-cog"></i> Settings</a>
            <a href="../dashboard/dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-sign-out-alt"></i> Log out</a>
        </div>
    </div>
</header>

<div class="ms-layout">
    <!-- ── Sidebar: board list, grouped ── -->
    <aside class="ms-sidebar">
        <div class="ms-sidebar-title">Manage Staff</div>
        <?php foreach ($groupOrder as $groupName): ?>
            <?php if (empty($groups[$groupName])) continue; ?>
            <div class="ms-group-label"><?= htmlspecialchars($groupName) ?></div>
            <?php foreach ($groups[$groupName] as $key => $cfg): ?>
                <button type="button" class="ms-board-btn <?= !empty($cfg['comingSoon']) ? 'coming-soon' : '' ?>" data-table="<?= htmlspecialchars($key) ?>">
                    <span class="ms-board-dot"></span>
                    <?= htmlspecialchars($cfg['label']) ?>
                    <?php if (!empty($cfg['comingSoon'])): ?><span class="ms-soon-tag">Soon</span><?php endif; ?>
                </button>
            <?php endforeach; ?>
        <?php endforeach; ?>
    </aside>

    <!-- ── Main board area ── -->
    <main class="ms-main">
        <div class="ms-board-header">
            <div>
                <h1 class="ms-board-title" id="board-title">Select a board</h1>
                <p class="ms-board-sub" id="board-sub">Pick something from the sidebar to get started.</p>
            </div>
            <button type="button" class="ms-add-btn" id="board-add-btn" style="display:none;"><i class="fas fa-plus"></i> Add Record</button>
        </div>
        <div id="board-content"><!-- rendered entirely by JS --></div>
    </main>
</div>

<!-- Record add/edit modal -->
<div class="ms-modal-backdrop" id="record-modal-backdrop">
    <div class="ms-modal">
        <div class="ms-modal-head">
            <h2 id="record-modal-title">Add Record</h2>
            <button class="ms-modal-close" id="record-modal-close"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="ms-modal-body" id="record-modal-body"><!-- form fields injected by JS --></div>
        <div class="ms-modal-footer">
            <button class="mbtn" id="record-cancel-btn">Cancel</button>
            <button class="mbtn primary" id="record-save-btn">Save</button>
        </div>
    </div>
</div>

<!-- Delete confirm -->
<div class="ms-modal-backdrop" id="confirm-modal-backdrop">
    <div class="ms-modal ms-modal-small">
        <div class="ms-modal-head"><h2>Delete this record?</h2></div>
        <div class="ms-modal-body"><p>This can't be undone.</p></div>
        <div class="ms-modal-footer">
            <button class="mbtn" id="confirm-cancel-btn">Cancel</button>
            <button class="mbtn danger" id="confirm-delete-btn">Delete</button>
        </div>
    </div>
</div>

<div class="toast-container" id="toast-container"></div>

<script>
const TABLE_CONFIG = <?= json_encode($tableConfig, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
const MY_PERM_LEVEL = <?= (int)$permLevel ?>;
</script>
<script src="admin.js?v=<?= filemtime(__DIR__ . '/admin.js') ?>"></script>
<?php include __DIR__ . '/../public/assets/version_badge.php'; ?>
<script src="../public/assets/avatar-cache.js"></script>
</body>
</html>