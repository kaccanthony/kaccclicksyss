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
    $timersByRow = $liveState['timers'] ?? [];

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

    // Bump quota progress for everyone who actually played a role this session.
    // Provisional rank→letter mapping — TODOs below need your input before this is fully correct.
    $RANK_TO_QUOTA_LETTER = [
        'Community Manager'   => 'M',
        'Operations Manager'  => 'M',
        'Head Staff'          => 'S', // TODO: some Head Staff may be on the "G" track instead — needs a way to tell them apart
        'Co-Host Authorized'  => 'C',
        'Assistant Authorized'=> 'A',
        'Event Authorized'    => 'N', // TODO: confirm this exact string exists in staff_list.staff_rank
    ];

    $quotaPeriod = date('Y-m', strtotime($s['session_date'] ?: 'now'));

    function bumpQuota($conn, $rankMap, $discordId, $rank, $period, $column) {
        if (!$discordId || !$rank || !isset($rankMap[$rank])) return;
        $letter = $rankMap[$rank];
        $quotaId = "Q-{$letter}-{$period}";

        $stmtFind = mysqli_prepare($conn, "SELECT quota_id FROM staff_quota WHERE quota_id = ?");
        mysqli_stmt_bind_param($stmtFind, "s", $quotaId);
        mysqli_stmt_execute($stmtFind);
        $exists = mysqli_stmt_get_result($stmtFind)->fetch_assoc();

        if (!$exists) {
            $stmtInsert = mysqli_prepare($conn, "INSERT INTO staff_quota
                (quota_id, discord_id, quota_level, quota_period, quota_assist, quota_co_host, quota_session_host, quota_event_host, quota_event_co_host, quota_remark, quota_exemption)
                VALUES (?, ?, 0, ?, 0, 0, 0, 0, 0, NULL, 0)");
            mysqli_stmt_bind_param($stmtInsert, "sss", $quotaId, $discordId, $period);
            mysqli_stmt_execute($stmtInsert);
        }

        $stmtBump = mysqli_prepare($conn, "UPDATE staff_quota SET `$column` = `$column` + 1 WHERE quota_id = ?");
        mysqli_stmt_bind_param($stmtBump, "s", $quotaId);
        mysqli_stmt_execute($stmtBump);
    }

    $rankByName = [];
    $resRanks = mysqli_query($conn, "SELECT staff_display_name, staff_name, staff_rank, staff_id FROM staff_list");
    while ($r = mysqli_fetch_assoc($resRanks)) {
        $rankByName[$r['staff_display_name'] ?: $r['staff_name']] = ['rank' => $r['staff_rank'], 'id' => $r['staff_id']];
    }

    if (!empty($s['host']) && isset($rankByName[$s['host']])) {
        bumpQuota($conn, $RANK_TO_QUOTA_LETTER, $rankByName[$s['host']]['id'], $rankByName[$s['host']]['rank'], $quotaPeriod, 'quota_session_host');
    }
    foreach (['co_host1','co_host2','co_host3','co_host4/supervisor'] as $col) {
        $name = $s[$col] ?? '';
        if ($name && isset($rankByName[$name])) {
            bumpQuota($conn, $RANK_TO_QUOTA_LETTER, $rankByName[$name]['id'], $rankByName[$name]['rank'], $quotaPeriod, 'quota_co_host');
        }
    }
    foreach (['assistant_1','assistant_2','assistant_3','assistant_4'] as $col) {
        $name = $s[$col] ?? '';
        if ($name && isset($rankByName[$name])) {
            bumpQuota($conn, $RANK_TO_QUOTA_LETTER, $rankByName[$name]['id'], $rankByName[$name]['rank'], $quotaPeriod, 'quota_assist');
        }
    }
    // End of quota functionism

    // 2. session_full_logs — one row per trainee that has a name
    for ($t = 1; $t <= 10; $t++) {
        $name = $s["trainee_{$t}_name"] ?? null;
        if (empty($name)) continue;

        $discordId   = $s["trainee_{$t}_discord_id"] ?? '';
        $zone        = (int)($s["trainee_{$t}_zone"] ?? 0);
        $notes       = $s["trainee_{$t}_note"] ?? null;
        $trainerName = $s["trainee_{$t}_trainer_name"] ?? '';
        $trainerId   = $directory[$trainerName] ?? '';

        $attendanceParts = explode(',', $s['trainee_attendance'] ?? '');
        $attended = isset($attendanceParts[$t-1]) ? (int)$attendanceParts[$t-1] : 0;

        // Check if this trainee actually has anything worth logging — row index is $t-1
        $rowKey = (string)($t - 1);
        $fb = $feedbackByRow[$rowKey] ?? [];
        if (!is_array($fb)) $fb = [];

        $trainsVal = trim($fb['trains'] ?? '');
        $setupSecondsVal = isset($timersByRow[$rowKey]['setupSeconds']) && $timersByRow[$rowKey]['setupSeconds'] !== null
            ? (int)$timersByRow[$rowKey]['setupSeconds']
            : null;

        $hasFeedback = false;
        foreach (['setup','conflict','priority','rbtiming','overall','notes'] as $field) {
            if (trim($fb[$field] ?? '') !== '') { $hasFeedback = true; break; }
        }
        if ($trainsVal !== '') $hasFeedback = true;
        if ($setupSecondsVal !== null) $hasFeedback = true;

        $stmtFull = mysqli_prepare($conn, "INSERT INTO session_full_logs
            (session_id, trainee_id, trainee_roblox, trainee_zone, trainee_attendance, trainer_id, trainee_notes, staff_notes, trainee_assessed, trainee_feedback, feedback_sent)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, 0)");
        $feedbackFlag = $hasFeedback ? 1 : 0;
        mysqli_stmt_bind_param($stmtFull, "issiissi",
            $sessionId, $discordId, $name, $zone, $attended, $trainerId, $notes, $feedbackFlag
        );
        if (!mysqli_stmt_execute($stmtFull)) throw new Exception(mysqli_error($conn));
        }
    }


        // Only write to session_feedback_logs if feedback was actually filled in
        if ($hasFeedback) {
            $fb['trains'] = $trainsVal;
            $fb['setupSeconds'] = $setupSecondsVal;
            $feedbackJson = json_encode($fb);
            $stmtFb = mysqli_prepare($conn, "INSERT INTO session_feedback_logs
                (session_id, trainee_id, trainer_id, feedback_json, created_at)
                VALUES (?, ?, ?, ?, NOW())");
            mysqli_stmt_bind_param($stmtFb, "isss", $sessionId, $discordId, $trainerId, $feedbackJson);
            if (!mysqli_stmt_execute($stmtFb)) throw new Exception(mysqli_error($conn));
        }
    }

    // 3. session_driver_logs — one row per driver
    $drivers = $liveState['drivers'] ?? [];
    if (is_array($drivers)) {
        foreach ($drivers as $driver) {
            $discordUsername = trim($driver['discord'] ?? '');
            $robloxName = trim($driver['roblox'] ?? '');
            if ($discordUsername === '' && $robloxName === '') continue;
            $attended = !empty($driver['attended']) ? 1 : 0;

            $stmtDriver = mysqli_prepare($conn, "INSERT INTO session_driver_logs
                (session_id, discord_username, roblox_name, attendance)
                VALUES (?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmtDriver, "issi", $sessionId, $discordUsername, $robloxName, $attended);
            if (!mysqli_stmt_execute($stmtDriver)) throw new Exception(mysqli_error($conn));
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