<?php
session_start();
require_once '../login/cnn.php';

// Forcing database connection to Europe Timezone
mysqli_query($conn, "SET time_zone = 'Europe/London';");

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
$staffId   = $user['id'] ?? '';

// Redirect if not authorized (Head Staff+)
$allowedRoles = ['Head Staff', 'Operations Manager', 'Community Manager'];
if (!in_array($role, $allowedRoles)) {
    header('Location: ../dashboard/dashboard.php');
    exit;
}

// Check avatar
$hasAvatar = false;
if ($staffId) {
    $stmt = mysqli_prepare($conn, "SELECT 1 FROM staff_list WHERE staff_id = ? AND LENGTH(staff_avatar) > 0");
    mysqli_stmt_bind_param($stmt, "s", $staffId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    $hasAvatar = mysqli_stmt_num_rows($stmt) > 0;
}

// ── Get today's date in BST ──
$bst = new DateTimeZone('Europe/London');
$now = new DateTime('now', $bst);
$todayBST = $now->format('Y-m-d');

// ── Fetch the logged-in user's display name from staff_list ──
$hostDisplayName = '';
$stmtHost = mysqli_prepare($conn, "SELECT staff_roblox_name, staff_name FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmtHost, "s", $staffId);
mysqli_stmt_execute($stmtHost);
$resHost = mysqli_stmt_get_result($stmtHost);
if ($rowHost = mysqli_fetch_assoc($resHost)) {
    $hostDisplayName = $rowHost['staff_roblox_name'] ?: $rowHost['staff_name'];
}

// ── Fetch today's sessions where logged-in user is Host ──
// Host field stores a display name like "Yoshi5336"
$sessions = [];
$stmtS = mysqli_prepare($conn,
    "SELECT * FROM session_upcoming
    WHERE session_date = ?
    AND host = ?
    ORDER BY session_time ASC"
);
mysqli_stmt_bind_param($stmtS, "ss", $todayBST, $hostDisplayName);
mysqli_stmt_execute($stmtS);
$resS = mysqli_stmt_get_result($stmtS);
while ($row = mysqli_fetch_assoc($resS)) {
    $sessions[] = $row;
}

// ── Improved Debugger (View Page Source to Inspect) ──
echo "<!-- SESSION DATA DEBUG: " . print_r($_SESSION['user'], true) . " -->";
echo "<!-- DATABASE QUERY DEBUG:
    Logged in Staff ID: '$staffId'
    Resolved Host Name: '$hostDisplayName'
    Query Date (BST):   '$todayBST'
    Sessions Found:     " . count($sessions) . "
-->";

// ── Fetch all staff for dropdowns (grouped by rank) ──
$staffByRank = [];
$stmtStaff = mysqli_prepare($conn,
"SELECT staff_id, staff_display_name, staff_name, staff_rank
    FROM staff_list
    WHERE staff_rank IN (
        'Assistant Authorized','Co-Host Authorized',
        'Head Staff','Operations Manager','Community Manager'
    )
    ORDER BY
    FIELD(staff_rank,'Community Manager','Operations Manager','Head Staff','Co-Host Authorized','Assistant Authorized'),
    staff_display_name ASC"
);
mysqli_stmt_execute($stmtStaff);
$resStaff = mysqli_stmt_get_result($stmtStaff);
while ($r = mysqli_fetch_assoc($resStaff)) {
    $staffByRank[$r['staff_rank']][] = $r;
}

// Helper: build option list filtered by allowed ranks
function buildOptions(array $staffByRank, array $allowedRanks, string $selected = ''): string {
    $html = '<option value="">— None —</option>';
    foreach ($allowedRanks as $rank) {
        if (empty($staffByRank[$rank])) continue;
        $html .= '<optgroup label="' . htmlspecialchars($rank) . '">';
        foreach ($staffByRank[$rank] as $s) {
            $name = htmlspecialchars($s['staff_display_name'] ?: $s['staff_name']);
            $sel  = ($selected === $name) ? ' selected' : '';
            $html .= '<option value="' . $name . '"' . $sel . '>' . $name . '</option>';
        }
        $html .= '</optgroup>';
    }
    return $html;
}

$assistRanks = ['Community Manager','Operations Manager','Head Staff','Co-Host Authorized','Assistant Authorized'];
$cohostRanks = ['Community Manager','Operations Manager','Head Staff','Co-Host Authorized'];
$hostRanks   = ['Community Manager','Operations Manager','Head Staff'];
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

<!-- ── Topbar ── -->
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

<!-- ── Main Layout ── -->
<main class="main">
    <div class="page-header">
        <div>
            <div class="section-eyebrow">Session Management</div>
            <h1 class="section-title">Setup Session</h1>
            <p class="section-sub">Today's sessions assigned to you — <?= $now->format('l, j F Y') ?> <span class="bst-badge">BST</span></p>
        </div>
    </div>

    <div class="layout-grid">

        <!-- ── LEFT: Session cards ── -->
        <section class="panel-left">
            <div class="panel-head">
                <span class="panel-label"><i class="fas fa-calendar-day"></i> Today's Sessions</span>
                <span class="session-count"><?= count($sessions) ?></span>
            </div>

            <?php if (empty($sessions)): ?>
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-calendar-xmark"></i></div>
                <div class="empty-title">No sessions today</div>
                <div class="empty-sub">Sessions assigned to you for <?= $now->format('j F') ?> will appear here.</div>
            </div>
            <?php else: ?>
            <div class="session-list">
                <?php foreach ($sessions as $idx => $s):
                    $timeFormatted = date('g:i A', strtotime($s['session_time']));
                    $statusClass   = strtolower($s['session_status']);
                    $isBooked      = (int)$s['session_booked'];
                    $slotsFilled   = 0;
                    for ($t = 1; $t <= 10; $t++) {
                        if (!empty($s["trainee_{$t}_name"])) $slotsFilled++;
                    }
                    $slotsTotal = (int)$s['num_slots'];
                ?>
                <div class="sesh-card <?= $idx === 0 ? 'active' : '' ?>"
                    data-id="<?= $s['session_id'] ?>"
                    onclick="selectSession(this, <?= $s['session_id'] ?>)">
                    <div class="sesh-card-top">
                        <div class="sesh-time">
                            <i class="fas fa-clock"></i>
                            <?= htmlspecialchars($timeFormatted) ?>
                        </div>
                        <div class="sesh-status sesh-status--<?= $statusClass ?>">
                            <?= htmlspecialchars($s['session_status']) ?>
                        </div>
                    </div>
                    <div class="sesh-name"><?= htmlspecialchars($s['session_name'] ?: 'Unnamed Session') ?></div>
                    <div class="sesh-meta">
                        <span><i class="fas fa-hourglass-half"></i> <?= htmlspecialchars($s['session_duration']) ?> min</span>
                        <span><i class="fas fa-users"></i> <?= $slotsFilled ?>/<?= $slotsTotal ?> trainees</span>
                    </div>
                    <?php if ($isBooked): ?>
                    <div class="sesh-booked-badge"><i class="fas fa-circle-check"></i> Booked</div>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </section>

        <!-- ── RIGHT: Detail panel ── -->
        <section class="panel-right" id="detail-panel">
            <?php if (empty($sessions)): ?>
            <div class="detail-empty">
                <i class="fas fa-hand-pointer"></i>
                <p>Select a session on the left to view its details.</p>
            </div>
            <?php else:
                // Pre-load first session for initial render
                $first = $sessions[0];
                $firstTime = date('g:i A', strtotime($first['session_time']));
                $firstSlotsFilled = 0;
                for ($t = 1; $t <= 10; $t++) {
                    if (!empty($first["trainee_{$t}_name"])) $firstSlotsFilled++;
                }
            ?>
            <div class="detail-inner" id="detail-inner">
                <?php include_once 'setupsesh_detail_partial.php'; // rendered via JS too ?>
                <!-- Rendered by JS; PHP pre-renders first card -->
                <?= renderDetailPanel($first, $staffByRank, $assistRanks, $cohostRanks, $hostRanks) ?>
            </div>
            <?php endif; ?>
        </section>

    </div>
</main>

<!-- ══════════════════════════════════════════
     SETUP SESSION MODAL
══════════════════════════════════════════ -->
<div class="modal-backdrop" id="modal-backdrop">
    <div class="modal" id="setup-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">

        <div class="modal-header">
            <div class="modal-title-wrap">
                <div class="modal-eyebrow">Configure</div>
                <h2 class="modal-title" id="modal-title">Setup Session</h2>
            </div>
            <button class="modal-close" onclick="closeModal()" aria-label="Close modal">
                <i class="fas fa-xmark"></i>
            </button>
        </div>

        <div class="modal-body">

            <!-- Session Info Banner -->
            <div class="modal-info-banner" id="modal-info-banner">
                <div class="mib-row">
                    <div class="mib-cell">
                        <div class="mib-label">Session</div>
                        <div class="mib-val" id="m-name">—</div>
                    </div>
                    <div class="mib-cell">
                        <div class="mib-label">Time</div>
                        <div class="mib-val" id="m-time">—</div>
                    </div>
                    <div class="mib-cell">
                        <div class="mib-label">Duration</div>
                        <div class="mib-val" id="m-dur">—</div>
                    </div>
                    <div class="mib-cell">
                        <div class="mib-label">Slots</div>
                        <div class="mib-val" id="m-slots">—</div>
                    </div>
                </div>
            </div>

            <!-- Staff Assignment -->
            <div class="modal-section">
                <div class="modal-section-title"><i class="fas fa-user-shield"></i> Staff Assignment</div>
                <div class="staff-grid">

                    <div class="staff-field">
                        <label class="staff-label">Host</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-crown staff-icon"></i>
                            <select class="staff-select" id="m-host" name="host">
                                <?= buildOptions($staffByRank, $hostRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Co-Host 1</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user-tie staff-icon"></i>
                            <select class="staff-select" id="m-cohost1" name="co_host1">
                                <?= buildOptions($staffByRank, $cohostRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Co-Host 2</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user-tie staff-icon"></i>
                            <select class="staff-select" id="m-cohost2" name="co_host2">
                                <?= buildOptions($staffByRank, $cohostRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Co-Host 3</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user-tie staff-icon"></i>
                            <select class="staff-select" id="m-cohost3" name="co_host3">
                                <?= buildOptions($staffByRank, $cohostRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Co-Host 4 / Supervisor</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user-gear staff-icon"></i>
                            <select class="staff-select" id="m-cohost4" name="co_host4">
                                <?= buildOptions($staffByRank, $cohostRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Assistant 1</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user staff-icon"></i>
                            <select class="staff-select" id="m-asst1" name="assistant_1">
                                <?= buildOptions($staffByRank, $assistRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Assistant 2</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user staff-icon"></i>
                            <select class="staff-select" id="m-asst2" name="assistant_2">
                                <?= buildOptions($staffByRank, $assistRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Assistant 3</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user staff-icon"></i>
                            <select class="staff-select" id="m-asst3" name="assistant_3">
                                <?= buildOptions($staffByRank, $assistRanks) ?>
                            </select>
                        </div>
                    </div>

                    <div class="staff-field">
                        <label class="staff-label">Assistant 4</label>
                        <div class="staff-input-wrap">
                            <i class="fas fa-user staff-icon"></i>
                            <select class="staff-select" id="m-asst4" name="assistant_4">
                                <?= buildOptions($staffByRank, $assistRanks) ?>
                            </select>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Trainee List -->
            <div class="modal-section">
                <div class="modal-section-title"><i class="fas fa-graduation-cap"></i> Trainees</div>
                <div class="trainee-list" id="modal-trainee-list">
                    <!-- filled by JS -->
                </div>
            </div>

            <!-- Description -->
            <div class="modal-section">
                <div class="modal-section-title"><i class="fas fa-align-left"></i> Session Description</div>
                <textarea class="modal-textarea" id="m-desc" name="session_desc" rows="3" placeholder="Session description…"></textarea>
            </div>

            <!-- Additional Notes -->
            <div class="modal-section">
                <div class="modal-section-title"><i class="fas fa-note-sticky"></i> Additional Notes</div>
                <textarea class="modal-textarea" id="m-notes" name="additional_notes" rows="2" placeholder="Any extra notes…"></textarea>
            </div>

        </div><!-- /modal-body -->

        <div class="modal-footer">
            <button type="button" class="btn-ghost" onclick="closeModal()">Cancel</button>
            <button type="button" class="btn-primary" id="confirm-setup-btn" onclick="confirmSetup()">
                <i class="fas fa-play"></i> Start Session Setup
            </button>
        </div>

    </div>
</div>

<!-- Embed session data for JS -->
<script>
const SESSIONS_DATA = <?= json_encode($sessions, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
const STAFF_DATA    = <?= json_encode($staffByRank, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
const HOST_RANKS    = <?= json_encode($hostRanks) ?>;
const COHOST_RANKS  = <?= json_encode($cohostRanks) ?>;
const ASST_RANKS    = <?= json_encode($assistRanks) ?>;
</script>
<script src="setupsesh.js"></script>
</body>
</html>
<?php
// ── PHP helper: render the right-panel detail ──
function renderDetailPanel(array $s, array $staffByRank, array $assistRanks, array $cohostRanks, array $hostRanks): string {
    $timeFormatted = date('g:i A', strtotime($s['session_time']));
    $slotsFilled = 0;
    for ($t = 1; $t <= 10; $t++) {
        if (!empty($s["trainee_{$t}_name"])) $slotsFilled++;
    }
    $trainees = [];
    for ($t = 1; $t <= 10; $t++) {
        if (!empty($s["trainee_{$t}_name"])) {
            $trainees[] = [
                'name' => $s["trainee_{$t}_name"],
                'zone' => $s["trainee_{$t}_zone"] ?? '',
                'note' => $s["trainee_{$t}_note"] ?? '',
            ];
        }
    }
    ob_start();
    ?>
    <div class="detail-header">
        <div class="detail-status detail-status--<?= strtolower(htmlspecialchars($s['session_status'])) ?>">
            <?= htmlspecialchars($s['session_status']) ?>
        </div>
        <h2 class="detail-name"><?= htmlspecialchars($s['session_name'] ?: 'Unnamed Session') ?></h2>
        <div class="detail-time-row">
            <span><i class="fas fa-clock"></i> <?= htmlspecialchars($timeFormatted) ?></span>
            <span><i class="fas fa-hourglass-half"></i> <?= htmlspecialchars($s['session_duration']) ?> min</span>
            <span><i class="fas fa-id-badge"></i> #<?= (int)$s['session_id'] ?></span>
        </div>
    </div>

    <div class="detail-stats">
        <div class="dstat">
            <div class="dstat-val"><?= $slotsFilled ?>/<?= (int)$s['num_slots'] ?></div>
            <div class="dstat-label">Trainees</div>
        </div>
        <div class="dstat">
            <div class="dstat-val"><?= htmlspecialchars($s['session_duration']) ?>m</div>
            <div class="dstat-label">Duration</div>
        </div>
        <div class="dstat">
            <div class="dstat-val"><?= htmlspecialchars($s['session_time']) ?></div>
            <div class="dstat-label">Start Time</div>
        </div>
    </div>

    <?php if (!empty($s['session_desc'])): ?>
    <div class="detail-desc"><?= nl2br(htmlspecialchars($s['session_desc'])) ?></div>
    <?php endif; ?>

    <!-- Assigned staff quick view -->
    <div class="detail-section">
        <div class="detail-section-label">Host & Staff</div>
        <div class="detail-staff-chips">
            <?php
            $staffFields = [
                'host'            => ['icon' => 'fa-crown',    'label' => 'Host'],
                'co_host1'        => ['icon' => 'fa-user-tie', 'label' => 'Co-Host'],
                'co_host2'        => ['icon' => 'fa-user-tie', 'label' => 'Co-Host'],
                'co_host3'        => ['icon' => 'fa-user-tie', 'label' => 'Co-Host'],
                'co_host4/supervisor' => ['icon' => 'fa-user-gear', 'label' => 'Supervisor'],
                'assistant_1'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                'assistant_2'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                'assistant_3'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                'assistant_4'     => ['icon' => 'fa-user',     'label' => 'Asst'],
            ];
            foreach ($staffFields as $field => $meta):
                $val = $s[$field] ?? '';
                if (empty($val)) continue;
            ?>
            <span class="staff-chip">
                <i class="fas <?= $meta['icon'] ?>"></i>
                <?= htmlspecialchars($val) ?>
                <span class="staff-chip-role"><?= $meta['label'] ?></span>
            </span>
            <?php endforeach; ?>
            <?php if (empty(array_filter(array_map(fn($f) => $s[$f] ?? '', array_keys($staffFields))))): ?>
                <span class="no-staff-msg">No staff assigned yet</span>
            <?php endif; ?>
        </div>
    </div>

    <!-- Trainee list -->
    <?php if (!empty($trainees)): ?>
    <div class="detail-section">
        <div class="detail-section-label">Trainees (<?= count($trainees) ?>)</div>
        <div class="trainee-chips">
            <?php foreach ($trainees as $tr): ?>
            <div class="trainee-chip">
                <div class="trainee-chip-avatar"><i class="fas fa-graduation-cap"></i></div>
                <div class="trainee-chip-info">
                    <div class="trainee-chip-name"><?= htmlspecialchars($tr['name']) ?></div>
                    <?php if (!empty($tr['zone'])): ?>
                    <div class="trainee-chip-zone">Zone <?= htmlspecialchars($tr['zone']) ?></div>
                    <?php endif; ?>
                </div>
                <?php if (!empty($tr['note'])): ?>
                <div class="trainee-chip-note" title="<?= htmlspecialchars($tr['note']) ?>">
                    <i class="fas fa-note-sticky"></i>
                </div>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <div class="detail-actions">
        <button class="btn-setup" onclick="openSetupModal(<?= $s['session_id'] ?>)">
            <i class="fas fa-play"></i> Setup Session
        </button>
    </div>
    <?php
    return ob_get_clean();
}
?>