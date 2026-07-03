<?php
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized access.']);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!$data || !isset($data['session_id'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data payload.']);
    exit;
}

$sessionId = (int)$data['session_id'];

// Host is NOT NULL on session_ongoing, so refuse to start without one
if (empty($data['host'])) {
    echo json_encode(['success' => false, 'message' => 'A Host must be assigned before starting the session.']);
    exit;
}

// Fields shared between the modal payload and both tables
$sharedFields = [
    'host'                => $data['host'],
    'co_host1'            => $data['co_host1'] ?: null,
    'co_host2'            => $data['co_host2'] ?: null,
    'co_host3'            => $data['co_host3'] ?: null,
    'co_host4/supervisor' => $data['co_host4'] ?: null,
    'assistant_1'         => $data['assistant_1'] ?: null,
    'assistant_2'         => $data['assistant_2'] ?: null,
    'assistant_3'         => $data['assistant_3'] ?: null,
    'assistant_4'         => $data['assistant_4'] ?: null,
    'session_desc'        => $data['session_desc'] ?: null,
    'additional_notes'    => $data['additional_notes'] ?: null,
];

for ($t = 1; $t <= 10; $t++) {
    $sharedFields["trainee_{$t}_name"] = !empty($data["trainee_{$t}_name"]) ? $data["trainee_{$t}_name"] : null;
    $sharedFields["trainee_{$t}_zone"] = !empty($data["trainee_{$t}_zone"]) ? (int)$data["trainee_{$t}_zone"] : null;
    $sharedFields["trainee_{$t}_note"] = !empty($data["trainee_{$t}_note"]) ? $data["trainee_{$t}_note"] : null;
}
mysqli_begin_transaction($conn);

try {
    // 1. Pull the full existing row from session_upcoming (need session_name, duration,
    //    num_slots, session_date, session_time, trainee_timer, additional_staff, etc.)
    $stmtGet = mysqli_prepare($conn, "SELECT * FROM session_upcoming WHERE session_id = ? FOR UPDATE");
    mysqli_stmt_bind_param($stmtGet, "i", $sessionId);
    mysqli_stmt_execute($stmtGet);
    $existing = mysqli_stmt_get_result($stmtGet)->fetch_assoc();

    if (!$existing) {
        throw new Exception('Session not found in session_upcoming.');
    }

    // 2. Merge: submitted staff/trainee data overrides, everything else carries over as-is
    $ongoingRow = array_merge($existing, $sharedFields);

    $ongoingColumns = [
        'session_id', 'session_status', 'session_name', 'session_desc', 'additional_notes',
        'session_duration', 'num_slots', 'host', 'co_host1', 'co_host2', 'co_host3',
        'co_host4/supervisor', 'assistant_1', 'assistant_2', 'assistant_3', 'assistant_4',
        'additional_staff', 'staff_attendance', 'session_date', 'session_time', 'trainee_timer',
    ];
    for ($t = 1; $t <= 10; $t++) {
        $ongoingColumns[] = "trainee_{$t}_name";
        $ongoingColumns[] = "trainee_{$t}_zone";
        $ongoingColumns[] = "trainee_{$t}_note";
    }
    $ongoingColumns[] = 'trainee_attendance';

    $ongoingRow['session_status'] = 'Ongoing';

    // 9 staff slots (host, co_host1-3, co_host4/supervisor, assistant_1-4), 1 char each,
    // no separator — matches varchar(10). All start unattended.
    $ongoingRow['staff_attendance'] = str_repeat('0', 9);

    // 10 trainee slots, comma-separated single digits — matches varchar(19) exactly.
    $ongoingRow['trainee_attendance'] = implode(',', array_fill(0, 10, '0'));

    $placeholders = implode(', ', array_fill(0, count($ongoingColumns), '?'));
    $colList      = implode(', ', array_map(fn($c) => "`$c`", $ongoingColumns));
    $insertSql    = "INSERT INTO session_ongoing ($colList) VALUES ($placeholders)";

    $types  = '';
    $params = [];
    foreach ($ongoingColumns as $col) {
        $val = $ongoingRow[$col] ?? null;
        $types .= is_int($val) ? 'i' : 's';
        $params[] = $val;
    }

    $stmtInsert = mysqli_prepare($conn, $insertSql);
    $bindParams = [$stmtInsert, $types];
    foreach ($params as $key => $value) {
        $bindParams[] = &$params[$key];
    }
    call_user_func_array('mysqli_stmt_bind_param', $bindParams);
    if (!mysqli_stmt_execute($stmtInsert)) {
        throw new Exception(mysqli_error($conn));
    }

    // 3. Remove from session_upcoming now that it lives in session_ongoing
    $stmtDelete = mysqli_prepare($conn, "DELETE FROM session_upcoming WHERE session_id = ?");
    mysqli_stmt_bind_param($stmtDelete, "i", $sessionId);
    if (!mysqli_stmt_execute($stmtDelete)) {
        throw new Exception(mysqli_error($conn));
    }

    mysqli_commit($conn);
    echo json_encode(['success' => true, 'session_id' => $sessionId, 'status' => 'Ongoing']);

} catch (Exception $e) {
    mysqli_rollback($conn);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}