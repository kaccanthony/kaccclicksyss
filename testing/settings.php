<?php
session_start();
include '../login/cnn.php';

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

$user      = $_SESSION['user'];
$username  = htmlspecialchars($user['username']);
$role      = htmlspecialchars($user['role'] ?? '');
$permLevel = (int)($user['perm_level'] ?? 0);
$avatar    = htmlspecialchars($user['avatar'] ?? '');
$staffId   = $user['id'] ?? '';

if (empty($user['role'])) {
    $_SESSION['error'] = 'Your account has no role assigned.';
    header('Location: ../login/login.php');
    exit;
}

// ── Fetch Staff Data ──
$isStaff = false;
$staffRow = null;
$stmt = mysqli_prepare($conn, "SELECT * FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmt, "s", $staffId);
mysqli_stmt_execute($stmt);
$staffResult = mysqli_stmt_get_result($stmt);
if ($staffRow = mysqli_fetch_assoc($staffResult)) {
    $isStaff = true;
}

// ── Fetch User Data ──
$isUser = false;
$userRow = null;
$stmtU = mysqli_prepare($conn, "SELECT * FROM user_list WHERE user_id = ?");
if ($stmtU) {
    mysqli_stmt_bind_param($stmtU, "s", $staffId);
    mysqli_stmt_execute($stmtU);
    $userResult = mysqli_stmt_get_result($stmtU);
    if ($userRow = mysqli_fetch_assoc($userResult)) {
        $isUser = true;
    }
}

// ── Load notification prefs ──
$prefs = [];
$stmt2 = mysqli_prepare($conn, "SELECT pref_key, pref_value FROM user_staff_notif_prefs WHERE user_id = ?");
mysqli_stmt_bind_param($stmt2, "s", $staffId);
mysqli_stmt_execute($stmt2);
$res2 = mysqli_stmt_get_result($stmt2);
while ($r = mysqli_fetch_assoc($res2)) {
    $prefs[$r['pref_key']] = $r['pref_value'];
}
$notifDefaults = [
    'staff_session_reminder'     => '1', 'staff_reminder_time'        => '15',
    'staff_trainee_sound'        => '1', 'staff_trainee_warning'      => '1',
    'staff_announcement_display' => 'fullscreen', 'staff_announcement_enabled' => '1',
    'user_session_reminder'      => '1', 'user_reminder_time'         => '15',
    'user_trainee_sound'         => '1', 'user_new_session'           => '1',
    'user_cancellation'          => '1', 'user_browser_notifs'        => '1',
];
foreach ($notifDefaults as $k => $v) {
    if (!array_key_exists($k, $prefs)) $prefs[$k] = $v;
}
function p($prefs, $key) { return $prefs[$key] ?? ''; }

// ── Handle POST ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'save_notifs') {
        $keys = [
            'staff_session_reminder','staff_reminder_time','staff_trainee_sound',
            'staff_trainee_warning','staff_announcement_enabled','staff_announcement_display',
            'user_session_reminder','user_reminder_time','user_trainee_sound',
            'user_new_session','user_cancellation','user_browser_notifs',
        ];
        $checkboxes = [
            'staff_session_reminder','staff_trainee_sound','staff_trainee_warning',
            'staff_announcement_enabled','user_session_reminder','user_trainee_sound',
            'user_new_session','user_cancellation','user_browser_notifs',
        ];
        foreach ($keys as $k) {
            $val = in_array($k, $checkboxes) ? (isset($_POST[$k]) ? '1' : '0') : ($_POST[$k] ?? '');
            $s3 = mysqli_prepare($conn,
                "INSERT INTO user_staff_notif_prefs (user_id, pref_key, pref_value)
                VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value)");
            mysqli_stmt_bind_param($s3, "sss", $staffId, $k, $val);
            mysqli_stmt_execute($s3);
        }
        header('Location: settings.php?saved=notifs');
        exit;
    }

    if ($action === 'save_profile_staff' && $isStaff) {
        $display_name     = trim($_POST['display_name']     ?? '');
        $discord_username = trim($_POST['discord_username'] ?? '');
        $roblox_name      = trim($_POST['roblox_name']      ?? '');
        $hide_stats       = isset($_POST['hide_stats']) ? 1 : 0;

        $s4 = mysqli_prepare($conn,
            "UPDATE staff_list SET staff_display_name=?, staff_name=?, staff_roblox_name=?, hide_stats=? WHERE staff_id=?");
        mysqli_stmt_bind_param($s4, "sssis", $display_name, $discord_username, $roblox_name, $hide_stats, $staffId);
        mysqli_stmt_execute($s4);

        if ($display_name) $_SESSION['user']['display_name'] = $display_name;
        header('Location: settings.php?saved=profile');
        exit;
    }

    if ($action === 'save_profile_user' && $isUser) {
        $display_name     = trim($_POST['display_name']     ?? '');
        $discord_username = trim($_POST['discord_username'] ?? '');
        $roblox_name      = trim($_POST['roblox_name']      ?? '');
        $hide_stats       = isset($_POST['hide_stats']) ? 1 : 0;

        $s5 = mysqli_prepare($conn,
            "UPDATE user_list SET user_display_name=?, user_name=?, user_roblox_name=?, hide_stats=? WHERE user_id=?");
        mysqli_stmt_bind_param($s5, "sssis", $display_name, $discord_username, $roblox_name, $hide_stats, $staffId);
        mysqli_stmt_execute($s5);

        header('Location: settings.php?saved=profile');
        exit;
    }
}

$saved   = $_GET['saved'] ?? '';
$dbError = $_SESSION['db_error'] ?? '';
unset($_SESSION['db_error']);

// ── Current profile values ──
$cur = [];
if ($isStaff && $staffRow) {
    $cur['display_name']     = $staffRow['staff_display_name']  ?? '';
    $cur['discord_username'] = $staffRow['staff_name']          ?? '';
    $cur['discord_id']       = $staffRow['staff_id']            ?? '';
    $cur['roblox_name']      = $staffRow['staff_roblox_name']   ?? '';
    $cur['hide_stats']       = $staffRow['hide_stats']          ?? 0;
} elseif ($isUser && $userRow) {
    $cur['display_name']       = $userRow['user_display_name']    ?? '';
    $cur['discord_username']   = $userRow['user_name']            ?? '';
    $cur['discord_id']         = $userRow['user_id']              ?? '';
    $cur['roblox_name']        = $userRow['user_roblox_name']     ?? '';
    $cur['hide_stats'] = $userRow['hide_stats']   ?? 0;
} else {
    $cur['display_name']     = '';
    $cur['discord_username'] = $user['username'] ?? '';
    $cur['discord_id']       = $staffId;
    $cur['roblox_name']      = $user['roblox_name'] ?? '';
    $cur['hide_stats']       = 0;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="/public/assets/images/icons/YSS%20Logo.png">
    <title>YSS – Settings</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="settings.css?v=<?= filemtime(__DIR__ . '/settings.css') ?>"/>
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
        <a href="dashboard.php" class="back-btn"><i class="fas fa-arrow-left"></i> Dashboard</a>
        <button class="profile-btn" id="profile-btn" aria-label="Profile menu">
            <div class="avatar">
                <?php if ($avatar): ?>
                    <img src="avatar.php?id=<?= htmlspecialchars($staffId) ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
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
                    <?php if ($avatar): ?>
                    <img src="avatar.php?id=<?= htmlspecialchars($staffId) ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                    <?php else: ?><i class="fas fa-user"></i><?php endif; ?>
                </div>
                <div>
                    <div class="popup-name"><?= $username ?></div>
                    <div class="popup-role"><?= $role ?></div>
                </div>
            </div>
            <div class="popup-divider"></div>
            <a href="notifications.php" class="popup-item"><i class="fas fa-bell"></i> Notifications</a>
            <a href="settings.php" class="popup-item"><i class="fas fa-cog"></i> Settings</a>
            <a href="../dashboard/dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-sign-out-alt"></i> Log out</a>
        </div>
    </div>
</header>

<main class="main">

    <div class="page-header">
        <div>
            <div class="section-label">Account Settings</div>
            <p class="section-sub">Manage your profile and notification preferences.</p>
        </div>
        <div class="toast-wrap" id="toast-wrap">
            <?php if ($saved === 'profile'): ?>
            <div class="save-toast"><i class="fas fa-circle-check"></i> Profile saved</div>
            <?php elseif ($saved === 'notifs'): ?>
            <div class="save-toast"><i class="fas fa-circle-check"></i> Notifications saved</div>
            <?php endif; ?>
            <?php if ($dbError): ?>
            <div class="error-toast"><i class="fas fa-triangle-exclamation"></i> <?= htmlspecialchars($dbError) ?></div>
            <?php endif; ?>
        </div>
    </div>

    <!-- ════ TAB BAR ════ -->
    <div class="tab-bar">
        <button type="button" class="tab-btn active" data-tab="profile">
            <i class="fas fa-id-card"></i> Profile
        </button>
        <?php if ($isStaff): ?>
        <button type="button" class="tab-btn" data-tab="staff-notifs">
            <i class="fas fa-user-shield"></i> Staff Notifications
        </button>
        <?php endif; ?>
        <button type="button" class="tab-btn" data-tab="user-notifs">
            <i class="fas fa-bell"></i> Notifications
        </button>
    </div>

    <!-- ════════════════════════
         PROFILE TAB
    ════════════════════════ -->
    <div class="settings-panel" id="panel-profile">

        <?php if ($isStaff && $staffRow): ?>
        <!-- STAFF PROFILE -->
        <form method="POST" action="" id="form-profile-staff">
            <input type="hidden" name="action" value="save_profile_staff"/>
            <div class="settings-section">
                <div class="settings-section-title">
                    <i class="fas fa-id-card"></i> Staff Profile
                </div>
                <p class="settings-section-desc">Changes to your display name and Roblox username will be reflected across the platform.</p>

                <!-- Profile header: avatar + name + change password button -->
                <div class="profile-header-row">
                    <div class="profile-avatar-wrap">
                        <div class="profile-avatar-big" id="avatar-preview-wrap">
                            <?php if ($avatar): ?>
                                <img src="avatar.php?id=<?= htmlspecialchars($staffId) ?>" alt="Avatar"
                                    id="avatar-preview"
                                    style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                            <?php else: ?>
                                <i class="fas fa-user" id="avatar-placeholder"></i>
                            <?php endif; ?>
                        </div>
                        <!-- Upload spinner overlay -->
                        <div class="avatar-uploading-ring" id="avatar-upload-ring">
                            <div class="spinner"></div>
                        </div>
                        <!-- Upload button (camera icon, bottom-right of avatar) -->
                        <label for="avatar-file-input" class="avatar-upload-btn" title="Upload photo (max 5 MiB)">
                            <i class="fas fa-camera"></i>
                        </label>
                        <input type="file" id="avatar-file-input" name="avatar"
                            accept="image/jpeg,image/png,image/gif,image/webp"/>
                    </div>

                    <div class="profile-avatar-info">
                        <div class="profile-avatar-name">
                            <?= htmlspecialchars($staffRow['staff_display_name'] ?: $staffRow['staff_name']) ?>
                        </div>
                        <div class="profile-avatar-role"><?= htmlspecialchars($staffRow['staff_rank']) ?></div>
                    </div>

                    <!-- Change Password button — far right -->
                    <div class="profile-header-right">
                        <button type="button" class="btn-change-pw" onclick="openPwModal()">
                            <i class="fas fa-key"></i> Change Password
                        </button>
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Display Name</label>
                        <div class="form-input-wrap">
                            <i class="fas fa-signature form-input-icon"></i>
                            <input type="text" name="display_name" id="staff-display-name"
                                class="form-input" maxlength="200"
                                placeholder="How you appear on the platform"
                                value="<?= htmlspecialchars($staffRow['staff_display_name']) ?>"/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Discord Username</label>
                        <div class="form-input-wrap">
                            <i class="fab fa-discord form-input-icon"></i>
                            <input type="text" name="discord_username" id="staff-discord-username"
                                class="form-input" maxlength="200"
                                placeholder="your_discord_username"
                                value="<?= htmlspecialchars($staffRow['staff_name']) ?>"/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Discord ID <span class="form-label-hint">read-only</span></label>
                        <div class="form-input-wrap">
                            <i class="fas fa-fingerprint form-input-icon"></i>
                            <input type="text" class="form-input readonly"
                                   value="<?= htmlspecialchars($cur['discord_id']) ?>" readonly/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Roblox Username</label>
                        <div class="form-input-wrap">
                            <i class="fas fa-gamepad form-input-icon"></i>
                            <input type="text" name="roblox_name" id="staff-roblox-name"
                                class="form-input" maxlength="100"
                                placeholder="Your Roblox username"
                                value="<?= htmlspecialchars($staffRow['staff_roblox_name']) ?>"/>
                        </div>
                    </div>
                </div>

                <!-- Hide stats toggle (no confirmation needed) -->
                <div class="notif-card" style="margin-top:16px;">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap purple"><i class="fas fa-eye-slash"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Hide Stats &amp; History</div>
                            <div class="notif-desc">Other staff members won't see your session attendance and history.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="hide_stats" <?= $cur['hide_stats'] ? 'checked' : '' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-save"
                            onclick="submitProfileForm('form-profile-staff','staff')">
                        <i class="fas fa-floppy-disk"></i> Save Profile
                    </button>
                </div>
            </div>
        </form>

        <?php elseif ($isUser && $userRow): ?>
        <!-- USER PROFILE -->
        <form method="POST" action="" id="form-profile-user">
            <input type="hidden" name="action" value="save_profile_user"/>
            <div class="settings-section">
                <div class="settings-section-title">
                    <i class="fas fa-id-card"></i> User Profile
                </div>

                <div class="profile-header-row">
                    <div class="profile-avatar-wrap">
                        <div class="profile-avatar-big" id="avatar-preview-wrap">
                            <?php if ($avatar): ?>
                                <img src="avatar.php?id=<?= htmlspecialchars($staffId) ?>" alt="Avatar"
                                    id="avatar-preview"
                                    style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                            <?php else: ?>
                                <i class="fas fa-user" id="avatar-placeholder"></i>
                            <?php endif; ?>
                        </div>
                        <div class="avatar-uploading-ring" id="avatar-upload-ring">
                            <div class="spinner"></div>
                        </div>
                        <label for="avatar-file-input" class="avatar-upload-btn" title="Upload photo (max 5 MiB)">
                            <i class="fas fa-camera"></i>
                        </label>
                        <input type="file" id="avatar-file-input" name="avatar"
                            accept="image/jpeg,image/png,image/gif,image/webp"/>
                    </div>

                    <div class="profile-avatar-info">
                        <div class="profile-avatar-name">
                            <?= htmlspecialchars($userRow['user_display_name'] ?: $username) ?>
                        </div>
                        <div class="profile-avatar-hint">Avatar is pulled from your uploaded photo.</div>
                    </div>

                    <div class="profile-header-right">
                        <button type="button" class="btn-change-pw" onclick="openPwModal()">
                            <i class="fas fa-key"></i> Change Password
                        </button>
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Display Name</label>
                        <div class="form-input-wrap">
                            <i class="fas fa-signature form-input-icon"></i>
                            <input type="text" name="display_name" id="user-display-name"
                                class="form-input" maxlength="50"
                                placeholder="How you appear on the platform"
                                value="<?= htmlspecialchars($userRow['user_display_name']) ?>"/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Discord Username</label>
                        <div class="form-input-wrap">
                            <i class="fab fa-discord form-input-icon"></i>
                            <input type="text" name="discord_username" id="user-discord-username"
                                   class="form-input" maxlength="100"
                                   placeholder="your_discord_username"
                                   value="<?= htmlspecialchars($userRow['user_name']) ?>"/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Discord ID <span class="form-label-hint">read-only</span></label>
                        <div class="form-input-wrap">
                            <i class="fas fa-fingerprint form-input-icon"></i>
                            <input type="text" class="form-input readonly"
                                   value="<?= htmlspecialchars($cur['discord_id']) ?>" readonly/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Roblox Username</label>
                        <div class="form-input-wrap">
                            <i class="fas fa-gamepad form-input-icon"></i>
                            <input type="text" name="roblox_name" id="user-roblox-name"
                                   class="form-input" maxlength="100"
                                   placeholder="Your Roblox username"
                                   value="<?= htmlspecialchars($userRow['user_roblox_name']) ?>"/>
                        </div>
                    </div>
                </div>

                <div class="notif-card" style="margin-top:16px;">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap purple"><i class="fas fa-eye-slash"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Hide Trainee Stats &amp; History</div>
                            <div class="notif-desc">Your training session history won't be visible to others.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="hide_stats"
                                <?= ($cur['hide_stats'] ?? 0) ? 'checked' : '' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-save"
                            onclick="submitProfileForm('form-profile-user','user')">
                        <i class="fas fa-floppy-disk"></i> Save Profile
                    </button>
                </div>
            </div>
        </form>

        <?php else: ?>
        <div class="not-staff-msg">
            <i class="fas fa-lock"></i>
            <p>Profile settings are not available for your account type.</p>
        </div>
        <?php endif; ?>

    </div><!-- /panel-profile -->


    <!-- ════════════════════════
         STAFF NOTIFICATIONS TAB
    ════════════════════════ -->
    <?php if ($isStaff): ?>
    <div class="settings-panel hidden" id="panel-staff-notifs">
        <form method="POST" action="">
            <input type="hidden" name="action" value="save_notifs"/>
            <div class="settings-section">
                <div class="settings-section-title"><i class="fas fa-shield-halved"></i> Staff Notifications</div>
                <p class="settings-section-desc">Active only while you're in a live session as host, co-host, or assistant.</p>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap green"><i class="far fa-calendar-check"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Upcoming Session Reminder</div>
                            <div class="notif-desc">Get alerted before your assigned session starts.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <div class="inline-control">
                            <span class="inline-label">Remind me</span>
                            <select name="staff_reminder_time"
                                    class="inline-select <?= p($prefs,'staff_session_reminder')==='0'?'disabled':'' ?>"
                                    id="staff-reminder-time">
                                <?php foreach (['5','10','15','30','60'] as $m): ?>
                                    <option value="<?= $m ?>" <?= p($prefs,'staff_reminder_time')===$m?'selected':'' ?>><?= $m ?> min before</option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <label class="toggle-wrap">
                            <input type="checkbox" name="staff_session_reminder"
                                   <?= p($prefs,'staff_session_reminder')==='1'?'checked':'' ?>
                                   onchange="toggleDependent(this,'staff-reminder-time')"/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap blue">
                            <img src="../icons/Nextrainee.png" alt="Next Trainee" style="width:22px;height:22px;object-fit:contain;"/>
                        </div>
                        <div class="notif-info">
                            <div class="notif-title">Next Trainee Sound Alert</div>
                            <div class="notif-desc">Play a sound cue when it's time to move to the next trainee.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="staff_trainee_sound"
                                   <?= p($prefs,'staff_trainee_sound')==='1'?'checked':'' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap amber"><i class="fas fa-hourglass-end"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Trainee Turn Ending Warning</div>
                            <div class="notif-desc">Notify 1 minute before the current trainee's time ends.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="staff_trainee_warning"
                                   <?= p($prefs,'staff_trainee_warning')==='1'?'checked':'' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap purple"><i class="fas fa-bullhorn"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Global Staff Announcement</div>
                            <div class="notif-desc">Display host announcements pushed during a live session.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <div class="inline-control">
                            <span class="inline-label">Display as</span>
                            <select name="staff_announcement_display"
                                    class="inline-select <?= p($prefs,'staff_announcement_enabled')==='0'?'disabled':'' ?>"
                                    id="staff-announce-display">
                                <option value="fullscreen" <?= p($prefs,'staff_announcement_display')==='fullscreen'?'selected':'' ?>>Full Screen</option>
                                <option value="banner"     <?= p($prefs,'staff_announcement_display')==='banner'    ?'selected':'' ?>>Banner</option>
                                <option value="toast"      <?= p($prefs,'staff_announcement_display')==='toast'     ?'selected':'' ?>>Toast</option>
                            </select>
                        </div>
                        <label class="toggle-wrap">
                            <input type="checkbox" name="staff_announcement_enabled"
                                   <?= p($prefs,'staff_announcement_enabled')==='1'?'checked':'' ?>
                                   onchange="toggleDependent(this,'staff-announce-display')"/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn-save"><i class="fas fa-floppy-disk"></i> Save</button>
                </div>
            </div>
        </form>
    </div>
    <?php endif; ?>


    <!-- ════════════════════════
         USER NOTIFICATIONS TAB
    ════════════════════════ -->
    <div class="settings-panel hidden" id="panel-user-notifs">
        <form method="POST" action="">
            <input type="hidden" name="action" value="save_notifs"/>
            <div class="settings-section">
                <div class="settings-section-title"><i class="fas fa-bell"></i> General Notifications</div>
                <p class="settings-section-desc">These apply to your account at all times.</p>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap green"><i class="far fa-calendar-check"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Upcoming Session Reminder</div>
                            <div class="notif-desc">Get reminded before a session you're assigned to begins.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <div class="inline-control">
                            <span class="inline-label">Remind me</span>
                            <select name="user_reminder_time"
                                    class="inline-select <?= p($prefs,'user_session_reminder')==='0'?'disabled':'' ?>"
                                    id="user-reminder-time">
                                <?php foreach (['5','10','15','30','60'] as $m): ?>
                                    <option value="<?= $m ?>" <?= p($prefs,'user_reminder_time')===$m?'selected':'' ?>><?= $m ?> min before</option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <label class="toggle-wrap">
                            <input type="checkbox" name="user_session_reminder"
                                   <?= p($prefs,'user_session_reminder')==='1'?'checked':'' ?>
                                   onchange="toggleDependent(this,'user-reminder-time')"/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap blue">
                            <img src="../icons/Nextrainee.png" alt="Next Trainee" style="width:22px;height:22px;object-fit:contain;"/>
                        </div>
                        <div class="notif-info">
                            <div class="notif-title">Next Trainee Sound Alert</div>
                            <div class="notif-desc">Play a sound when it's your turn as the next trainee.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="user_trainee_sound"
                                   <?= p($prefs,'user_trainee_sound')==='1'?'checked':'' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap purple"><i class="fas fa-calendar-plus"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">New Session Notifications</div>
                            <div class="notif-desc">Be notified when a new session is booked and open.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="user_new_session"
                                   <?= p($prefs,'user_new_session')==='1'?'checked':'' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap red"><i class="far fa-window-close"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Session Cancellation Alerts</div>
                            <div class="notif-desc">Get notified if a session you're part of is cancelled.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="user_cancellation"
                                   <?= p($prefs,'user_cancellation')==='1'?'checked':'' ?>/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="notif-card">
                    <div class="notif-card-left">
                        <div class="notif-icon-wrap amber"><i class="fas fa-bell"></i></div>
                        <div class="notif-info">
                            <div class="notif-title">Browser Notifications</div>
                            <div class="notif-desc">Allow YSS to send native browser push notifications.</div>
                        </div>
                    </div>
                    <div class="notif-card-right">
                        <label class="toggle-wrap">
                            <input type="checkbox" name="user_browser_notifs"
                                   <?= p($prefs,'user_browser_notifs')==='1'?'checked':'' ?>
                                   onchange="requestBrowserPermission(this)"/>
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn-save"><i class="fas fa-floppy-disk"></i> Save</button>
                </div>
            </div>
        </form>
    </div>

</main>


<!-- ═══════════════════════════════════════
     CHANGE PASSWORD MODAL
═══════════════════════════════════════ -->
<div class="pw-modal-backdrop" id="pw-modal-backdrop" onclick="closePwModalOnBackdrop(event)">
    <div class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
        <div class="pw-modal-header">
            <div class="pw-modal-title" id="pw-modal-title">
                <i class="fas fa-key"></i> Change Password
            </div>
            <button class="pw-modal-close" onclick="closePwModal()" aria-label="Close"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="pw-field">
            <label for="pw-old">Current Password</label>
            <div class="pw-input-wrap">
                <i class="fas fa-lock icon"></i>
                <input type="password" id="pw-old" class="pw-input" placeholder="Enter your current password" autocomplete="current-password"/>
                <button type="button" class="pw-toggle-vis" onclick="togglePwVis('pw-old', this)" tabindex="-1">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>

        <div class="pw-field">
            <label for="pw-new">New Password</label>
            <div class="pw-input-wrap">
                <i class="fas fa-lock-open icon"></i>
                <input type="password" id="pw-new" class="pw-input" placeholder="At least 8 characters" autocomplete="new-password"/>
                <button type="button" class="pw-toggle-vis" onclick="togglePwVis('pw-new', this)" tabindex="-1">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>

        <div class="pw-field">
            <label for="pw-re">Re-enter New Password</label>
            <div class="pw-input-wrap">
                <i class="fas fa-lock-open icon"></i>
                <input type="password" id="pw-re" class="pw-input" placeholder="Repeat new password" autocomplete="new-password"/>
                <button type="button" class="pw-toggle-vis" onclick="togglePwVis('pw-re', this)" tabindex="-1">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>

        <!-- Error message -->
        <div class="pw-error" id="pw-error">
            <i class="fas fa-circle-exclamation"></i>
            <span id="pw-error-msg"></span>
        </div>

        <!-- Forgot password -->
        <div class="pw-forgot-wrap">
            <button type="button" class="pw-forgot" onclick="toggleForgotPopup(event)">
                Forgot your password?
            </button>
            <div class="forgot-popup" id="forgot-popup">
                <i class="fas fa-circle-info" style="color:#7289da;margin-right:6px;"></i>
                Contact <b>kacc</b> in Discord to reset or change your password.
            </div>
        </div>

        <div class="pw-modal-footer">
            <button type="button" class="btn-ghost" onclick="closePwModal()">Cancel</button>
            <button type="button" class="btn-save" id="pw-submit-btn" onclick="submitPasswordChange()">
                <div class="pw-spinner"></div>
                <span class="pw-btn-label"><i class="fas fa-check"></i> Confirm</span>
            </button>
        </div>
    </div>
</div>


<!-- ═══════════════════════════════════════
     PROFILE SAVE CONFIRM MODAL
═══════════════════════════════════════ -->
<div class="confirm-backdrop" id="confirm-backdrop">
    <div class="confirm-box" role="dialog" aria-modal="true">
        <h3>Save changes?</h3>
        <p id="confirm-desc">Review the fields below and confirm you want to save these profile changes.</p>
        <div class="confirm-footer">
            <button type="button" class="btn-ghost" onclick="closeConfirm()" style="padding:8px 16px;border-radius:8px;border:1.5px solid rgba(255,255,255,.12);background:transparent;color:#a0a0b0;font-size:13px;font-family:inherit;cursor:pointer;">Cancel</button>
            <button type="button" class="btn-save" id="confirm-ok-btn" style="padding:8px 18px;border-radius:8px;border:none;background:var(--accent,#6c63ff);color:#fff;font-size:13px;font-family:inherit;font-weight:600;cursor:pointer;">Save</button>
        </div>
    </div>
</div>

<script src="settings.js"></script>
</body>
</html>