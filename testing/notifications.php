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

// ── Is this user a staff member? ──
$isStaff = false;
$stmt = mysqli_prepare($conn, "SELECT staff_id FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmt, "s", $staffId);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);
$isStaff = mysqli_stmt_num_rows($stmt) > 0;

// ── Load existing prefs or defaults ──
$prefs = [];
$stmt2 = mysqli_prepare($conn, "SELECT pref_key, pref_value FROM user_staff_notif_prefs WHERE user_id = ?");
mysqli_stmt_bind_param($stmt2, "s", $staffId);
mysqli_stmt_execute($stmt2);
$res2 = mysqli_stmt_get_result($stmt2);
while ($r = mysqli_fetch_assoc($res2)) {
    $prefs[$r['pref_key']] = $r['pref_value'];
}

// ── Defaults if not yet saved ──
$defaults = [
    // Staff prefs
    'staff_session_reminder'      => '1',
    'staff_reminder_time'         => '15',
    'staff_trainee_sound'         => '1',
    'staff_trainee_warning'       => '1',
    'staff_announcement_display'  => 'fullscreen',
    'staff_announcement_enabled'  => '1',
    // User prefs
    'user_session_reminder'       => '1',
    'user_reminder_time'          => '15',
    'user_trainee_sound'          => '1',
    'user_new_session'            => '1',
    'user_cancellation'           => '1',
    'user_browser_notifs'         => '1',
];
foreach ($defaults as $k => $v) {
    if (!isset($prefs[$k])) $prefs[$k] = $v;
}

function p($prefs, $key) { return $prefs[$key] ?? ''; }

// ── Save on POST ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $keys = [
        'staff_session_reminder','staff_reminder_time','staff_trainee_sound',
        'staff_trainee_warning','staff_announcement_enabled','staff_announcement_display',
        'user_session_reminder','user_reminder_time','user_trainee_sound',
        'user_new_session','user_cancellation','user_browser_notifs',
    ];

    // Checkboxes default to off if not in POST
    $checkboxes = [
        'staff_session_reminder','staff_trainee_sound','staff_trainee_warning',
        'staff_announcement_enabled','user_session_reminder','user_trainee_sound',
        'user_new_session','user_cancellation','user_browser_notifs',
    ];

    foreach ($keys as $k) {
        if (in_array($k, $checkboxes)) {
            $val = isset($_POST[$k]) ? '1' : '0';
        } else {
            $val = $_POST[$k] ?? '';
        }

        // Upsert
        $stmt3 = mysqli_prepare($conn,
            "INSERT INTO user_staff_notif_prefs (user_id, pref_key, pref_value)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value)"
        );
        mysqli_stmt_bind_param($stmt3, "sss", $staffId, $k, $val);
        mysqli_stmt_execute($stmt3);
    }

    header('Location: notifications.php?saved=1');
    exit;
}

$saved = isset($_GET['saved']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="../icons/YSS Logo.png">
    <title>YSS – Notifications</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="notifications.css?v=<?= time() ?>"/>
</head>
<body>
<div id="bg"></div>

<!-- ── Topbar ── -->
<header class="topbar">
    <div class="logo-wrap">
        <div class="pulse-ring"></div>
        <div class="pulse-ring ring2"></div>
        <img src="../icons/YSS Logo.png" alt="YSS Logo" class="logo-img"/>
    </div>
    <span class="app-name">YSS Session Manager</span>
    <div class="topbar-right">
        <a href="dashboard.php" class="back-btn"><i class="fas fa-arrow-left"></i> Dashboard</a>
        <button class="profile-btn" id="profile-btn" aria-label="Profile menu">
            <div class="avatar">
                <?php if ($avatar): ?>
                    <img src="<?= $avatar ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
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
                        <img src="<?= $avatar ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>
                    <?php else: ?><i class="fas fa-user"></i><?php endif; ?>
                </div>
                <div>
                    <div class="popup-name"><?= $username ?></div>
                    <div class="popup-role"><?= $role ?></div>
                </div>
            </div>
            <div class="popup-divider"></div>
            <a href="settings.php" class="popup-item"><i class="fas fa-gear"></i> Settings</a>
            <a href="dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-right-from-bracket"></i> Log out</a>
        </div>
    </div>
</header>

<main class="main">

    <div class="page-header">
        <div>
            <div class="section-label">Notification Center</div>
            <p class="section-sub">Control how and when you get notified.</p>
        </div>
        <?php if ($saved): ?>
        <div class="save-toast"><i class="fas fa-circle-check"></i> Preferences saved</div>
        <?php endif; ?>
    </div>

    <form method="POST" action="" id="notif-form">

        <!-- ════════════════════════════════
             TAB SWITCHER (only if staff)
        ════════════════════════════════ -->
        <?php if ($isStaff): ?>
        <div class="tab-bar">
            <button type="button" class="tab-btn active" data-tab="staff">
                <i class="fas fa-shield-halved"></i> Staff View
            </button>
            <button type="button" class="tab-btn" data-tab="user">
                <i class="fas fa-user"></i> User View
            </button>
        </div>
        <?php endif; ?>

        <!-- ════════════════════════════════
             STAFF PANEL
        ════════════════════════════════ -->
        <div class="notif-panel" id="panel-staff">

            <?php if ($isStaff): ?>
            <div class="panel-eyebrow"><i class="fas fa-shield-halved"></i> Staff Notifications</div>
            <p class="panel-desc">These appear only while you are active in a session as host, co-host, or assistant.</p>

            <!-- Session Reminder -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap green">
                        <i class="fas fa-calendar-clock"></i>
                    </div>
                    <div class="notif-info">
                        <div class="notif-title">Upcoming Session Reminder</div>
                        <div class="notif-desc">Get alerted before your assigned session starts.</div>
                    </div>
                </div>
                <div class="notif-card-right">
                    <div class="inline-control">
                        <span class="inline-label">Remind me</span>
                        <select name="staff_reminder_time" class="inline-select <?= p($prefs,'staff_session_reminder')==='0'?'disabled':'' ?>" id="staff-reminder-time">
                            <?php foreach (['5','10','15','30','60'] as $m): ?>
                                <option value="<?= $m ?>" <?= p($prefs,'staff_reminder_time')===$m?'selected':'' ?>><?= $m ?> min before</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <label class="toggle-wrap">
                        <input type="checkbox" name="staff_session_reminder" id="tog-staff-reminder"
                            <?= p($prefs,'staff_session_reminder')==='1'?'checked':'' ?>
                            onchange="toggleDependent(this,'staff-reminder-time')"/>
                        <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    </label>
                </div>
            </div>

            <!-- Trainee Sound Alert -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap blue">
                        <i class="fas fa-volume-high"></i>
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

            <!-- Trainee Turn Ending Warning -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap amber">
                        <i class="fas fa-hourglass-end"></i>
                    </div>
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

            <!-- Global Staff Announcement -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap purple">
                        <i class="fas fa-bullhorn"></i>
                    </div>
                    <div class="notif-info">
                        <div class="notif-title">Global Staff Announcement</div>
                        <div class="notif-desc">Display host announcements pushed during a live session.</div>
                    </div>
                </div>
                <div class="notif-card-right">
                    <div class="inline-control">
                        <span class="inline-label">Display as</span>
                        <select name="staff_announcement_display" class="inline-select <?= p($prefs,'staff_announcement_enabled')==='0'?'disabled':'' ?>" id="staff-announce-display">
                            <option value="fullscreen" <?= p($prefs,'staff_announcement_display')==='fullscreen'?'selected':'' ?>>Full Screen</option>
                            <option value="banner"     <?= p($prefs,'staff_announcement_display')==='banner'    ?'selected':'' ?>>Banner</option>
                            <option value="toast"      <?= p($prefs,'staff_announcement_display')==='toast'     ?'selected':'' ?>>Toast</option>
                        </select>
                    </div>
                    <label class="toggle-wrap">
                        <input type="checkbox" name="staff_announcement_enabled" id="tog-announce"
                            <?= p($prefs,'staff_announcement_enabled')==='1'?'checked':'' ?>
                            onchange="toggleDependent(this,'staff-announce-display')"/>
                        <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    </label>
                </div>
            </div>

            <?php else: ?>
            <!-- Not a staff member -->
            <div class="not-staff-msg">
                <i class="fas fa-lock"></i>
                <p>Staff notifications are only available to active staff members.</p>
            </div>
            <?php endif; ?>

        </div><!-- /panel-staff -->

        <!-- ════════════════════════════════
             USER PANEL
        ════════════════════════════════ -->
        <div class="notif-panel <?= $isStaff ? 'hidden' : '' ?>" id="panel-user">

            <div class="panel-eyebrow"><i class="fas fa-user"></i> General Notifications</div>
            <p class="panel-desc">These apply to your account regardless of your staff role.</p>

            <!-- Session Reminder -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap green">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="notif-info">
                        <div class="notif-title">Upcoming Session Reminder</div>
                        <div class="notif-desc">Get reminded before a session you're assigned to begins.</div>
                    </div>
                </div>
                <div class="notif-card-right">
                    <div class="inline-control">
                        <span class="inline-label">Remind me</span>
                        <select name="user_reminder_time" class="inline-select <?= p($prefs,'user_session_reminder')==='0'?'disabled':'' ?>" id="user-reminder-time">
                            <?php foreach (['5','10','15','30','60'] as $m): ?>
                                <option value="<?= $m ?>" <?= p($prefs,'user_reminder_time')===$m?'selected':'' ?>><?= $m ?> min before</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <label class="toggle-wrap">
                        <input type="checkbox" name="user_session_reminder" id="tog-user-reminder"
                            <?= p($prefs,'user_session_reminder')==='1'?'checked':'' ?>
                            onchange="toggleDependent(this,'user-reminder-time')"/>
                        <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    </label>
                </div>
            </div>

            <!-- Trainee Sound Alert -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap blue">
                        <i class="fas fa-volume-high"></i>
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

            <!-- New Session -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap purple">
                        <i class="fas fa-calendar-plus"></i>
                    </div>
                    <div class="notif-info">
                        <div class="notif-title">New Session Notifications</div>
                        <div class="notif-desc">Be notified when a new session is booked and open for sign-up.</div>
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

            <!-- Cancellation -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap red">
                        <i class="fas fa-calendar-xmark"></i>
                    </div>
                    <div class="notif-info">
                        <div class="notif-title">Session Cancellation Alerts</div>
                        <div class="notif-desc">Get notified if a session you're part of is cancelled or postponed.</div>
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

            <!-- Browser Notifications -->
            <div class="notif-card">
                <div class="notif-card-left">
                    <div class="notif-icon-wrap amber">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="notif-info">
                        <div class="notif-title">Browser Notifications</div>
                        <div class="notif-desc">Allow YSS to send native browser push notifications.</div>
                    </div>
                </div>
                <div class="notif-card-right">
                    <label class="toggle-wrap">
                        <input type="checkbox" name="user_browser_notifs" id="tog-browser"
                            <?= p($prefs,'user_browser_notifs')==='1'?'checked':'' ?>
                            onchange="requestBrowserPermission(this)"/>
                        <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    </label>
                </div>
            </div>

        </div><!-- /panel-user -->

        <!-- Save -->
        <div class="form-actions">
            <button type="submit" class="btn-save">
                <i class="fas fa-floppy-disk"></i> Save Preferences
            </button>
        </div>

    </form>
</main>

<script src="notifications.js"></script>
</body>
</html>