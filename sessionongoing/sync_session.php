<?php
// sync_session.php
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// Columns safe to write directly as real DB fields (used for reporting/querying).
// Everything else (timers, overrides, bell state, driver rows, staff-shift rows,
// per-trainee trainer assignment, feedback drafts) travels inside `live_state` instead.
$CORE_COLUMNS = [
    'session_status', 'host', 'co_host1', 'co_host2', 'co_host3', 'co_host4/supervisor',
    'assistant_1', 'assistant_2', 'assistant_3', 'assistant_4',
    'staff_attendance', 'trainee_attendance', 'additional_notes',
];
for ($t = 1; $t <= 10; $t++) {
    $CORE_COLUMNS[] = "trainee_{$t}_name";
    $CORE_COLUMNS[] = "trainee_{$t}_discord";
    $CORE_COLUMNS[] = "trainee_{$t}_discord_id";
    $CORE_COLUMNS[] = "trainee_{$t}_zone";
    $CORE_COLUMNS[] = "trainee_{$t}_note";
    $CORE_COLUMNS[] = "trainee_{$t}_trainer_name";
}

function fetchRow($conn, $sessionId) {
    $stmt = mysqli_prepare($conn, "SELECT * FROM session_ongoing WHERE session_id = ?");
    mysqli_stmt_bind_param($stmt, "i", $sessionId);
    mysqli_stmt_execute($stmt);
    return mysqli_stmt_get_result($stmt)->fetch_assoc();
}

function decodeLiveState($row) {
    if (empty($row['live_state'])) return [];
    $decoded = json_decode($row['live_state'], true);
    return is_array($decoded) ? $decoded : [];
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sessionId = (int)($_GET['session_id'] ?? 0);
    if (!$sessionId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing session_id.']);
        exit;
    }
    $row = fetchRow($conn, $sessionId);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Session not found.']);
        exit;
    }
    echo json_encode([
        'success' => true,
        'session' => $row,
        'live_state' => decodeLiveState($row),
        'last_updated' => $row['last_updated'],
    ]);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['session_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid payload.']);
        exit;
    }
    $sessionId = (int)$data['session_id'];

    mysqli_begin_transaction($conn);
    try {
        // 1. Core column updates, if any were sent
        if (!empty($data['updates']) && is_array($data['updates'])) {
            $sets = [];
            $types = '';
            $params = [];
            foreach ($data['updates'] as $col => $val) {
                if (!in_array($col, $CORE_COLUMNS, true)) continue; // ignore unknown/unsafe columns
                $sets[] = "`$col` = ?";
                $types .= is_int($val) ? 'i' : 's';
                $params[] = $val;
            }
            if ($sets) {
                $types .= 'i';
                $params[] = $sessionId;
                $sql = "UPDATE session_ongoing SET " . implode(', ', $sets) . ", last_updated = NOW() WHERE session_id = ?";
                $stmt = mysqli_prepare($conn, $sql);
                $bind = [$stmt, $types];
                foreach ($params as $k => $v) $bind[] = &$params[$k];
                call_user_func_array('mysqli_stmt_bind_param', $bind);
                if (!mysqli_stmt_execute($stmt)) throw new Exception(mysqli_error($conn));
            }
        }

        // 2. Shallow-merge live_state on top of what's already stored, so one tab
        //    updating timers doesn't wipe out another tab's bell-state update sent moments apart
if (isset($data['live_state']) && is_array($data['live_state'])) {
    $stmtGet = mysqli_prepare($conn, "SELECT live_state FROM session_ongoing WHERE session_id = ? FOR UPDATE");
    mysqli_stmt_bind_param($stmtGet, "i", $sessionId);
    mysqli_stmt_execute($stmtGet);
    $existingRow = mysqli_stmt_get_result($stmtGet)->fetch_assoc();
    $existing = $existingRow ? decodeLiveState($existingRow) : [];
    $incoming = $data['live_state'];

    // Top-level replace for everything EXCEPT the keyed sub-objects below, which get
    // deep-merged per-entry instead — otherwise one client's stale full snapshot of
    // "timers" or "unallocatedTrainees" wipes out another client's concurrent edit
    // to a different row/uid inside that same object.
    $merged = array_replace($existing, $incoming);
    foreach (['timers', 'completedRows', 'timeTracker'] as $keyedObjectField) {
        if (isset($incoming[$keyedObjectField]) && is_array($incoming[$keyedObjectField])) {
            $merged[$keyedObjectField] = array_replace($existing[$keyedObjectField] ?? [], $incoming[$keyedObjectField]);
        }
    }
    if (isset($incoming['unallocatedTrainees']) && is_array($incoming['unallocatedTrainees'])) {
        $existingByUid = [];
        foreach (($existing['unallocatedTrainees'] ?? []) as $u) if (!empty($u['uid'])) $existingByUid[$u['uid']] = $u;
        foreach ($incoming['unallocatedTrainees'] as $u) if (!empty($u['uid'])) $existingByUid[$u['uid']] = $u;
        // Any uid present in $existing but missing from $incoming was deleted client-side —
        // trust the incoming list's membership, just merge field-values per uid.
        $incomingUids = array_column($incoming['unallocatedTrainees'], 'uid');
        $merged['unallocatedTrainees'] = array_values(array_filter($existingByUid, fn($u) => in_array($u['uid'], $incomingUids, true)));
    }
    $mergedJson = json_encode($merged);

            $stmtUpd = mysqli_prepare($conn, "UPDATE session_ongoing SET live_state = ?, last_updated = NOW() WHERE session_id = ?");
            mysqli_stmt_bind_param($stmtUpd, "si", $mergedJson, $sessionId);
            if (!mysqli_stmt_execute($stmtUpd)) throw new Exception(mysqli_error($conn));
        }

        mysqli_commit($conn);

        $fresh = fetchRow($conn, $sessionId);
        echo json_encode([
            'success' => true,
            'session' => $fresh,
            'live_state' => decodeLiveState($fresh),
            'last_updated' => $fresh['last_updated'],
        ]);
    } catch (Exception $e) {
        mysqli_rollback($conn);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed.']);