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

// ── Handle POST: Add / Edit / Delete ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $permLevel >= 10) {
    $action = $_POST['action'] ?? '';

    if ($action === 'delete' && $permLevel >= 15) {
        $del_id = (int)$_POST['session_id'];
        $stmt = mysqli_prepare($conn, "DELETE FROM session_upcoming WHERE session_id = ?");
        mysqli_stmt_bind_param($stmt, "i", $del_id);
        mysqli_stmt_execute($stmt);
        header('Location: managesession.php');
        exit;
    }

    if ($action === 'add' || $action === 'edit') {
        $sn   = $_POST['session_name']        ?? '';
        $sd   = $_POST['session_desc']        ?? '';
        $ss   = $_POST['session_status']      ?? 'Scheduled';
        $sb   = isset($_POST['session_booked']) ? 1 : 0;
        $sdur = $_POST['session_duration']    ?? '';
        $ns   = (int)($_POST['num_slots']     ?? 0);
        $sdate= $_POST['session_date']        ?? '';
        $stime= $_POST['session_time']        ?? '';
        $tt   = (int)($_POST['trainee_timer'] ?? 0);
        $host = $_POST['host']                ?? '';
        $ch1  = $_POST['co_host1']            ?? '';
        $ch2  = $_POST['co_host2']            ?? '';
        $ch3  = $_POST['co_host3']            ?? '';
        $ch4  = $_POST['co_host4_supervisor'] ?? '';
        $as1  = $_POST['assistant_1']         ?? '';
        $as2  = $_POST['assistant_2']         ?? '';
        $as3  = $_POST['assistant_3']         ?? '';
        $as4  = $_POST['assistant_4']         ?? '';
        $add  = $_POST['additional_staff']    ?? '';

        if ($action === 'add') {
            $sql = "INSERT INTO session_upcoming
                (session_name,session_desc,session_status,session_booked,
                 session_duration,num_slots,session_date,session_time,trainee_timer,
                 host,co_host1,co_host2,co_host3,`co_host4/supervisor`,
                 assistant_1,assistant_2,assistant_3,assistant_4,additional_staff)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
            $stmt = mysqli_prepare($conn, $sql);
            mysqli_stmt_bind_param($stmt,'sssisiissssssssssss',
                $sn,$sd,$ss,$sb,$sdur,$ns,$sdate,$stime,$tt,
                $host,$ch1,$ch2,$ch3,$ch4,$as1,$as2,$as3,$as4,$add);
        } else {
            $eid = (int)$_POST['session_id'];
            $sql = "UPDATE session_upcoming SET
                session_name=?,session_desc=?,session_status=?,session_booked=?,
                session_duration=?,num_slots=?,session_date=?,session_time=?,
                trainee_timer=?,host=?,co_host1=?,co_host2=?,co_host3=?,
                `co_host4/supervisor`=?,assistant_1=?,assistant_2=?,
                assistant_3=?,assistant_4=?,additional_staff=?
                WHERE session_id=?";
            $stmt = mysqli_prepare($conn, $sql);
            mysqli_stmt_bind_param($stmt,'sssisiissssssssssssi',
                $sn,$sd,$ss,$sb,$sdur,$ns,$sdate,$stime,$tt,
                $host,$ch1,$ch2,$ch3,$ch4,$as1,$as2,$as3,$as4,$add,$eid);
        }
        mysqli_stmt_execute($stmt);
        header('Location: managesession.php');
        exit;
    }
}

// ── Search / filter ──
$search        = trim($_GET['search'] ?? '');
$filter_status = $_GET['status'] ?? '';
$filter_host   = trim($_GET['host'] ?? '');

$where=[]; $params=[]; $types='';
if ($search !== '') {
    $where[] = "(s.session_id LIKE ? OR s.host LIKE ? OR s.session_name LIKE ?)";
    $like="%$search%"; $params[]=$like; $params[]=$like; $params[]=$like; $types.='sss';
}
if ($filter_status !== '') { $where[]="s.session_status=?"; $params[]=$filter_status; $types.='s'; }
if ($filter_host !== '')   { $where[]="s.host LIKE ?"; $params[]="%$filter_host%"; $types.='s'; }

$sql = "SELECT * FROM session_upcoming s";
if ($where) $sql .= " WHERE ".implode(" AND ",$where);
$sql .= " ORDER BY s.session_date ASC, s.session_time ASC";

$stmt = mysqli_prepare($conn, $sql);
if ($params) mysqli_stmt_bind_param($stmt, $types, ...$params);
mysqli_stmt_execute($stmt);
$sessions = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);

// ── Staff list for autocomplete ──
$staff_result = mysqli_query($conn,"SELECT staff_roblox_name,staff_rank FROM staff_list ORDER BY staff_rank,staff_roblox_name");
$staff_list   = mysqli_fetch_all($staff_result, MYSQLI_ASSOC);

function statusBadge($status) {
    $map=['Scheduled'=>'badge-scheduled','Booked'=>'badge-booked','Cancelled'=>'badge-cancelled','Postponed'=>'badge-postponed'];
    $cls=$map[$status]??'badge-scheduled';
    return "<span class='badge $cls'>".htmlspecialchars($status)."</span>";
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="icon" type="image/png" href="../icons/YSS Logo.png">
    <title>YSS – Manage Sessions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="managesession.css?v=<?= filemtime(__DIR__ . '/managesession.css') ?>"/>
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

<!-- ── Main ── -->
<main class="main">
    <div class="page-header">
        <div>
            <div class="section-label">Manage Sessions</div>
            <p class="section-sub"><?= count($sessions) ?> session<?= count($sessions)!==1?'s':'' ?> total</p>
        </div>
        <?php if ($permLevel >= 10): ?>
        <button class="btn-primary" onclick="openModal('add')">
            <i class="fas fa-plus"></i> Book Session
        </button>
        <?php endif; ?>
    </div>

    <!-- Filter bar -->
    <form class="filter-bar" method="GET" action="">
        <div class="search-wrap">
            <i class="fas fa-magnifying-glass search-icon"></i>
            <input type="text" name="search" class="search-input"
                placeholder="Search by ID, host, or session name…"
                value="<?= htmlspecialchars($search) ?>" autocomplete="off"/>
            <?php if ($search): ?>
                <button type="button" class="search-clear"
                    onclick="this.closest('form').search.value='';this.closest('form').submit()">
                    <i class="fas fa-xmark"></i>
                </button>
            <?php endif; ?>
        </div>
        <select name="status" class="filter-select" onchange="this.form.submit()">
            <option value="">All Statuses</option>
            <?php foreach (['Scheduled','Booked','Cancelled','Postponed'] as $s): ?>
                <option value="<?= $s ?>" <?= $filter_status===$s?'selected':'' ?>><?= $s ?></option>
            <?php endforeach; ?>
        </select>
        <input type="text" name="host" class="filter-input" placeholder="Filter by host…"
               value="<?= htmlspecialchars($filter_host) ?>"/>
        <button type="submit" class="btn-filter"><i class="fas fa-filter"></i> Filter</button>
        <?php if ($search||$filter_status||$filter_host): ?>
            <a href="managesession.php" class="btn-clear-link">Clear</a>
        <?php endif; ?>
    </form>

    <!-- Table -->
    <div class="table-wrap">
        <?php if (empty($sessions)): ?>
        <div class="empty-state">
            <i class="fas fa-calendar-xmark"></i>
            <p>No sessions found.</p>
            <?php if ($search||$filter_status||$filter_host): ?>
                <a href="managesession.php" class="btn-clear-link">Clear filters</a>
            <?php endif; ?>
        </div>
        <?php else: ?>
        <table class="session-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Host</th>
                    <th>Date &amp; Time</th>
                    <th>Slots</th>
                    <th>Duration</th>
                    <?php if ($permLevel >= 10): ?><th>Actions</th><?php endif; ?>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($sessions as $s): ?>
                <tr>
                    <td class="td-id">#<?= htmlspecialchars($s['session_id']) ?></td>
                    <td class="td-name">
                        <span class="session-name"><?= htmlspecialchars($s['session_name']??'—') ?></span>
                        <?php if (!empty($s['session_desc'])): ?>
                            <span class="session-desc"><?= htmlspecialchars(mb_strimwidth($s['session_desc'],0,55,'…')) ?></span>
                        <?php endif; ?>
                    </td>
                    <td><?= statusBadge($s['session_status']) ?></td>
                    <td class="td-host">
                        <i class="fas fa-crown td-host-icon"></i>
                        <?= htmlspecialchars($s['host']) ?>
                    </td>
                    <td class="td-date">
                        <span class="date-main"><?= date('M j, Y',strtotime($s['session_date'])) ?></span>
                        <span class="date-time"><?= date('g:i A',strtotime($s['session_time'])) ?></span>
                    </td>
                    <td>
                        <?php $filled=0; for($i=1;$i<=10;$i++) if(!empty($s["trainee_{$i}_name"])) $filled++; ?>
                        <span class="slots-pill <?= $filled>=$s['num_slots']?'slots-full':'' ?>">
                            <?= $filled ?>/<?= $s['num_slots'] ?>
                        </span>
                    </td>
                    <td class="td-dur"><?= htmlspecialchars($s['session_duration']) ?>h</td>
                    <?php if ($permLevel >= 10): ?>
                    <td class="td-actions">
                        <button class="action-btn" title="Edit"
                            onclick='openModal("edit",<?= htmlspecialchars(json_encode($s),ENT_QUOTES) ?>)'>
                            <i class="fas fa-pen"></i>
                        </button>
                        <?php if ($permLevel >= 15): ?>
                        <button class="action-btn danger" title="Delete"
                            onclick="confirmDelete(<?= $s['session_id'] ?>,'<?= htmlspecialchars(addslashes($s['session_name']??'this session')) ?>')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <?php endif; ?>
                    </td>
                    <?php endif; ?>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>
</main>

<!-- ══ SESSION MODAL ══ -->
<div class="modal-backdrop" id="modal-backdrop">
<div class="modal-box" id="modal-box">
    <div class="modal-header">
        <h2 class="modal-title" id="modal-title">Book Session</h2>
        <button class="modal-close-btn" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
    </div>
    <form method="POST" action="" id="session-form" class="modal-form">
        <input type="hidden" name="action" id="form-action" value="add"/>
        <input type="hidden" name="session_id" id="form-session-id" value=""/>

        <!-- Name + Status + Booked toggle -->
        <div class="form-row">
            <div class="form-group flex2">
                <label>Session Name</label>
                <input type="text" name="session_name" id="f-session_name" placeholder="e.g. Training Session #42" required/>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select name="session_status" id="f-session_status">
                    <option value="Scheduled">Scheduled</option>
                    <option value="Booked">Booked</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Postponed">Postponed</option>
                </select>
            </div>
            <div class="form-group form-check-group">
                <label>Booked?</label>
                <label class="toggle-wrap">
                    <input type="checkbox" name="session_booked" id="f-session_booked"/>
                    <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
            </div>
        </div>

        <!-- Description -->
        <div class="form-group">
            <label>Description</label>
            <textarea name="session_desc" id="f-session_desc" rows="2" placeholder="Short session description…"></textarea>
        </div>

        <!-- Date / Time / Duration / Slots / Timer -->
        <div class="form-row">
            <div class="form-group">
                <label>Date</label>
                <input type="date" name="session_date" id="f-session_date" required/>
            </div>
            <div class="form-group">
                <label>Time</label>
                <input type="time" name="session_time" id="f-session_time" required/>
            </div>
            <div class="form-group">
                <label>Duration (hrs)</label>
                <input type="number" name="session_duration" id="f-session_duration" min="1" max="12" placeholder="2"/>
            </div>
            <div class="form-group">
                <label>Slots</label>
                <input type="number" name="num_slots" id="f-num_slots" min="1" max="10" placeholder="10"/>
            </div>
            <div class="form-group">
                <label>Trainee Timer (min)</label>
                <input type="number" name="trainee_timer" id="f-trainee_timer" min="0" placeholder="15"/>
            </div>
        </div>

        <div class="form-divider"><span>Staff Assignment</span></div>

        <!-- Host -->
        <div class="form-row">
            <div class="form-group flex2">
                <label><i class="fas fa-crown" style="color:rgba(255,210,80,.7);font-size:.7rem;margin-right:4px;"></i> Host</label>
                <input type="text" name="host" id="f-host" list="staff-datalist" placeholder="Roblox username" required/>
            </div>
        </div>

        <!-- Co-Hosts -->
        <div class="form-row">
            <div class="form-group">
                <label>Co-Host 1</label>
                <input type="text" name="co_host1" id="f-co_host1" list="staff-datalist" placeholder="Optional"/>
            </div>
            <div class="form-group">
                <label>Co-Host 2</label>
                <input type="text" name="co_host2" id="f-co_host2" list="staff-datalist" placeholder="Optional"/>
            </div>
            <div class="form-group">
                <label>Co-Host 3</label>
                <input type="text" name="co_host3" id="f-co_host3" list="staff-datalist" placeholder="Optional"/>
            </div>
            <div class="form-group">
                <label>Co-Host 4 / Supervisor</label>
                <input type="text" name="co_host4_supervisor" id="f-co_host4_supervisor" list="staff-datalist" placeholder="Optional"/>
            </div>
        </div>

        <!-- Assistants -->
        <div class="form-row">
            <div class="form-group">
                <label>Assistant 1</label>
                <input type="text" name="assistant_1" id="f-assistant_1" list="staff-datalist" placeholder="Optional"/>
            </div>
            <div class="form-group">
                <label>Assistant 2</label>
                <input type="text" name="assistant_2" id="f-assistant_2" list="staff-datalist" placeholder="Optional"/>
            </div>
            <div class="form-group">
                <label>Assistant 3</label>
                <input type="text" name="assistant_3" id="f-assistant_3" list="staff-datalist" placeholder="Optional"/>
            </div>
            <div class="form-group">
                <label>Assistant 4</label>
                <input type="text" name="assistant_4" id="f-assistant_4" list="staff-datalist" placeholder="Optional"/>
            </div>
        </div>

        <!-- Additional staff -->
        <div class="form-group">
            <label>Additional Staff <span class="label-hint">(include role after name)</span></label>
            <input type="text" name="additional_staff" id="f-additional_staff" placeholder="e.g. Yoshi5336 [Observer]"/>
        </div>

        <!-- Staff datalist autocomplete -->
        <datalist id="staff-datalist">
            <?php foreach ($staff_list as $sl): ?>
                <option value="<?= htmlspecialchars($sl['staff_roblox_name']) ?>">
            <?php endforeach; ?>
        </datalist>

        <div class="modal-footer">
            <button type="button" class="btn-ghost" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" id="form-submit-btn">Book Session</button>
        </div>
    </form>
</div>
</div>

<!-- ══ DELETE CONFIRM MODAL ══ -->
<div class="modal-backdrop" id="delete-backdrop">
<div class="modal-box modal-sm">
    <div class="modal-header">
        <h2 class="modal-title">Delete Session</h2>
        <button class="modal-close-btn" onclick="closeDelete()"><i class="fas fa-xmark"></i></button>
    </div>
    <p class="delete-msg" id="delete-msg">Are you sure you want to delete this session?</p>
    <form method="POST" action="">
        <input type="hidden" name="action" value="delete"/>
        <input type="hidden" name="session_id" id="delete-session-id" value=""/>
        <div class="modal-footer">
            <button type="button" class="btn-ghost" onclick="closeDelete()">Cancel</button>
            <button type="submit" class="btn-danger">Delete</button>
        </div>
    </form>
</div>
</div>

<script src="script.js"></script>
</body>
</html>