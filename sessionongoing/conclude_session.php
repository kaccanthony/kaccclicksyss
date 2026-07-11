<?php
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$sessionId = (int)($data['session_id'] ?? 0);
if (!$sessionId) {
    echo json_encode(['success' => false, 'message' => 'Missing session_id.']);
    exit;
}

mysqli_begin_transaction($conn);
try {
    $stmt = mysqli_prepare($conn, "SELECT * FROM session_ongoing WHERE session_id = ? FOR UPDATE");
    mysqli_stmt_bind_param($stmt, "i", $sessionId);
    mysqli_stmt_execute($stmt);
    $s = mysqli_stmt_get_result($stmt)->fetch_assoc();
    if (!$s) throw new Exception('Session not found.');

    // Staff directory (name -> discord id) for trainer_id lookups below
    $directory = [];
    $resStaff = mysqli_query($conn, "SELECT staff_id, staff_display_name, staff_name FROM staff_list");
    while ($r = mysqli_fetch_assoc($resStaff)) {
        $directory[$r['staff_display_name'] ?: $r['staff_name']] = $r['staff_id'];
    }

    // Decode live_state to pull out any feedback drafts, keyed by row index (0-based)
    $liveState = [];
    if (!empty($s['live_state'])) {
        $decodedLive = json_decode($s['live_state'], true);
        if (is_array($decodedLive)) $liveState = $decodedLive;
    }
    $feedbackByRow = $liveState['feedbackData'] ?? [];

    // 1. session_staff_logs — one summary row
    $startTime = $s['started_at'] ? date('H:i:s', strtotime($s['started_at'])) : date('H:i:s');
    $endTime   = date('H:i:s');
    $stmtLog = mysqli_prepare($conn, "INSERT INTO session_staff_logs
        (session_id, host, cohost_1, cohost_2, cohost_3, `cohost_4/supervisor`, assistant_1, assistant_2, assistant_3, assistant_4, date, started, ended, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    mysqli_stmt_bind_param($stmtLog, "isssssssssssss",
        $sessionId, $s['host'], $s['co_host1'], $s['co_host2'], $s['co_host3'], $s['co_host4/supervisor'],
        $s['assistant_1'], $s['assistant_2'], $s['assistant_3'], $s['assistant_4'],
        $s['session_date'], $startTime, $endTime, $s['session_duration']
    );
    if (!mysqli_stmt_execute($stmtLog)) throw new Exception(mysqli_error($conn));

    // 2. session_full_logs — one row per trainee that has a name
    for ($t = 1; $t <= 10; $t++) {
        $name = $s["trainee_{$t}_name"] ?? null;
        if (empty($name)) continue;

        $discordId   = $s["trainee_{$t}_discord_id"] ?? '';
        $zone        = (int)($s["trainee_{$t}_zone"] ?? 0);
        $notes       = $s["trainee_{$t}_note"] ?? null;
        $trainerName = $s["trainee_{$t}_trainer_name"] ?? '';
        $trainerId   = $directory[$trainerName] ?? '';

        // Attendance comes from the comma-separated trainee_attendance string
        $attendanceParts = explode(',', $s['trainee_attendance'] ?? '');
        $attended = isset($attendanceParts[$t-1]) ? (int)$attendanceParts[$t-1] : 0;

        // Check if this trainee actually has any feedback written — row index is $t-1
        $rowKey = (string)($t - 1);
        $fb = $feedbackByRow[$rowKey] ?? null;
        $hasFeedback = false;
        if (is_array($fb)) {
            foreach (['setup','conflict','priority','rbtiming','overall','notes'] as $field) {
                if (trim($fb[$field] ?? '') !== '') { $hasFeedback = true; break; }
            }
        }

        $stmtFull = mysqli_prepare($conn, "INSERT INTO session_full_logs
            (session_id, trainee_id, trainee_roblox, trainee_zone, trainee_attendance, trainer_id, trainee_notes, staff_notes, trainee_assessed, trainee_feedback, feedback_sent)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, 0)");
        $feedbackFlag = $hasFeedback ? 1 : 0;
        mysqli_stmt_bind_param($stmtFull, "issiissi",
            $sessionId, $discordId, $name, $zone, $attended, $trainerId, $notes, $feedbackFlag
        );
        if (!mysqli_stmt_execute($stmtFull)) throw new Exception(mysqli_error($conn));

        // Only write to session_feedback_logs if feedback was actually filled in
        if ($hasFeedback) {
            $feedbackJson = json_encode($fb);
            $stmtFb = mysqli_prepare($conn, "INSERT INTO session_feedback_logs
                (session_id, trainee_id, trainer_id, feedback_json, created_at)
                VALUES (?, ?, ?, ?, NOW())");
            mysqli_stmt_bind_param($stmtFb, "isss", $sessionId, $discordId, $trainerId, $feedbackJson);
            if (!mysqli_stmt_execute($stmtFb)) throw new Exception(mysqli_error($conn));
        }
    }

    // 3. Remove the now-archived session from session_ongoing
    $stmtDel = mysqli_prepare($conn, "DELETE FROM session_ongoing WHERE session_id = ?");
    mysqli_stmt_bind_param($stmtDel, "i", $sessionId);
    if (!mysqli_stmt_execute($stmtDel)) throw new Exception(mysqli_error($conn));

    mysqli_commit($conn);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    mysqli_rollback($conn);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}