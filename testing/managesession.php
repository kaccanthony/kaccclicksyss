<?php
session_start();
include '../login/cnn.php';

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

$user      = $_SESSION['user'];
$username  = htmlspecialchars($user['username']);
$role      = htmlspecialchars($user['role'] ?? '');
$permLevel = (int)($user['perm_level'] ?? 0);
$avatar    = htmlspecialchars($user['avatar'] ?? '');

if (empty($user['role'])) {
    $_SESSION['error'] = 'Your account has no role assigned. Contact an admin.';
    header('Location: ../login/login.php');
    exit;
}

// ── Search / filter params ──
$search     = trim($_GET['search'] ?? '');
$filter_status = $_GET['status'] ?? '';
$filter_host   = trim($_GET['host'] ?? '');

// ── Build query ──
$where = [];
$params = [];
$types  = '';

if ($search !== '') {
    $where[] = "(s.session_id LIKE ? OR s.host LIKE ? OR s.session_name LIKE ?)";
    $like = "%$search%";
    $params[] = $like; $params[] = $like; $params[] = $like;
    $types .= 'sss';
}
if ($filter_status !== '') {
    $where[] = "s.session_status = ?";
    $params[] = $filter_status;
    $types .= 's';
}
if ($filter_host !== '') {
    $where[] = "s.host LIKE ?";
    $params[] = "%$filter_host%";
    $types .= 's';
}

$sql = "SELECT * FROM session_upcoming s";
if ($where) $sql .= " WHERE " . implode(" AND ", $where);
$sql .= " ORDER BY s.session_date ASC, s.session_time ASC";

$stmt = mysqli_prepare($conn, $sql);
if ($params) mysqli_stmt_bind_param($stmt, $types, ...$params);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$sessions = mysqli_fetch_all($result, MYSQLI_ASSOC);

// ── Status badge helper ──
function statusBadge($status) {
    $map = [
        'Scheduled' => 'badge-scheduled',
        'Booked'    => 'badge-booked',
        'Cancelled' => 'badge-cancelled',
        'Postponed' => 'badge-postponed',
    ];
    $cls = $map[$status] ?? 'badge-scheduled';
    return "<span class='badge $cls'>" . htmlspecialchars($status) . "</span>";
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="../icons/YSS Logo.png">
    <title>YSS – Upcoming Sessions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="managesession.css" />
</head>
<body>

<div id="bg"></div>

<!-- ── Top bar ── -->
<header class="topbar">
    <div class="logo-wrap">
        <div class="pulse-ring"></div>
        <div class="pulse-ring ring2"></div>
        <img src="../icons/YSS Logo.png" alt="YSS Logo" class="logo-img" />
    </div>
    <span class="app-name">YSS Session Manager</span>

    <div class="topbar-right">
        <a href="dashboard.php" class="back-btn"><i class="fas fa-arrow-left"></i> Dashboard</a>

        <button class="profile-btn" id="profile-btn" aria-label="Profile menu">
            <div class="avatar">
                <?php if ($avatar): ?>
                    <img src="<?= $avatar ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />
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
                    <?php if ($avatar): ?>
                        <img src="<?= $avatar ?>" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />
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
            <a href="settings.php" class="popup-item"><i class="fas fa-gear"></i> Settings</a>
            <a href="dashboard.php?logout=1" class="popup-item danger"><i class="fas fa-right-from-bracket"></i> Log out</a>
        </div>
    </div>
</header>

<!-- ── Main ── -->
<main class="main">

    <!-- Page header -->
    <div class="page-header">
        <div>
            <div class="section-label">Upcoming Sessions</div>
            <p class="section-sub"><?= count($sessions) ?> session<?= count($sessions) !== 1 ? 's' : '' ?> found</p>
        </div>
        <?php if ($permLevel >= 10): ?>
        <a href="booking.php" class="btn-primary"><i class="fas fa-plus"></i> Book Session</a>
        <?php endif; ?>
    </div>

    <!-- Search + filters -->
    <form class="filter-bar" method="GET" action="">
        <div class="search-wrap">
            <i class="fas fa-magnifying-glass search-icon"></i>
            <input
                type="text"
                name="search"
                class="search-input"
                placeholder="Search by ID, host, or session name…"
                value="<?= htmlspecialchars($search) ?>"
                autocomplete="off"
            />
            <?php if ($search): ?>
                <button type="button" class="search-clear" onclick="this.closest('form').search.value='';this.closest('form').submit()">
                    <i class="fas fa-xmark"></i>
                </button>
            <?php endif; ?>
        </div>

        <select name="status" class="filter-select" onchange="this.form.submit()">
            <option value="">All Statuses</option>
            <?php foreach (['Scheduled','Booked','Cancelled','Postponed'] as $s): ?>
                <option value="<?= $s ?>" <?= $filter_status === $s ? 'selected' : '' ?>><?= $s ?></option>
            <?php endforeach; ?>
        </select>

        <input type="text" name="host" class="filter-input" placeholder="Filter by host…"
               value="<?= htmlspecialchars($filter_host) ?>" />

        <button type="submit" class="btn-filter"><i class="fas fa-filter"></i> Filter</button>

        <?php if ($search || $filter_status || $filter_host): ?>
            <a href="upcoming.php" class="btn-clear">Clear</a>
        <?php endif; ?>
    </form>

    <!-- Session table -->
    <div class="table-wrap">
        <?php if (empty($sessions)): ?>
        <div class="empty-state">
            <i class="fas fa-calendar-xmark"></i>
            <p>No sessions match your search.</p>
            <a href="upcoming.php" class="btn-clear">Clear filters</a>
        </div>
        <?php else: ?>
        <table class="session-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Host</th>
                    <th>Date & Time</th>
                    <th>Slots</th>
                    <th>Duration</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($sessions as $s): ?>
                <tr>
                    <td class="td-id">#<?= htmlspecialchars($s['session_id']) ?></td>
                    <td class="td-name">
                        <span class="session-name"><?= htmlspecialchars($s['session_name'] ?? '—') ?></span>
                        <?php if ($s['session_desc']): ?>
                            <span class="session-desc"><?= htmlspecialchars(mb_strimwidth($s['session_desc'], 0, 60, '…')) ?></span>
                        <?php endif; ?>
                    </td>
                    <td><?= statusBadge($s['session_status']) ?></td>
                    <td class="td-host">
                        <i class="fas fa-crown td-host-icon"></i>
                        <?= htmlspecialchars($s['host']) ?>
                    </td>
                    <td class="td-date">
                        <span class="date-main"><?= date('M j, Y', strtotime($s['session_date'])) ?></span>
                        <span class="date-time"><?= date('g:i A', strtotime($s['session_time'])) ?></span>
                    </td>
                    <td class="td-slots">
                        <?php
                            $filled = 0;
                            for ($i = 1; $i <= 10; $i++) {
                                if (!empty($s["trainee_{$i}_name"])) $filled++;
                            }
                        ?>
                        <span class="slots-pill <?= $filled >= $s['num_slots'] ? 'slots-full' : '' ?>">
                            <?= $filled ?>/<?= $s['num_slots'] ?>
                        </span>
                    </td>
                    <td class="td-dur"><?= htmlspecialchars($s['session_duration']) ?>h</td>
                    <td class="td-actions">
                        <a href="session_view.php?id=<?= $s['session_id'] ?>" class="action-btn" title="View"><i class="fas fa-eye"></i></a>
                        <?php if ($permLevel >= 10): ?>
                        <a href="session_edit.php?id=<?= $s['session_id'] ?>" class="action-btn" title="Edit"><i class="fas fa-pen"></i></a>
                        <?php endif; ?>
                        <?php if ($permLevel >= 15): ?>
                        <a href="session_delete.php?id=<?= $s['session_id'] ?>" class="action-btn danger" title="Delete"
                        onclick="return confirm('Delete session #<?= $s['session_id'] ?>?')">
                            <i class="fas fa-trash"></i>
                        </a>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

</main>

<script src="script.js"></script>
</body>
</html>