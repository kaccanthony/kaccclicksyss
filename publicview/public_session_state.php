<?php
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['error'=>'Unauthorized']); exit; }

$sessionId = (int)($_GET['session_id'] ?? 0);
if (!$sessionId) { echo json_encode(['rows'=>[]]); exit; }

$stmt = mysqli_prepare($conn, "SELECT * FROM session_ongoing WHERE session_id = ?");
mysqli_stmt_bind_param($stmt, "i", $sessionId);
mysqli_stmt_execute($stmt);
$s = mysqli_stmt_get_result($stmt)->fetch_assoc();
if (!$s) { echo json_encode(['rows'=>[]]); exit; }

$completedRows = [];
if (!empty($s['live_state'])) {
    $live = json_decode($s['live_state'], true);
    $completedRows = $live['completedRows'] ?? [];
}

$rows = [];
for ($t = 1; $t <= 10; $t++) {
    if (empty($s["trainee_{$t}_discord"])) continue;
    $rows[] = [
        'slot'    => $t,
        'discord' => $s["trainee_{$t}_discord"],
        'roblox'  => $s["trainee_{$t}_name"] ?? '',
        'zone'    => $s["trainee_{$t}_zone"] ?? null,
        'trainer' => $s["trainee_{$t}_trainer_name"] ?? '',
        'done'    => !empty($completedRows[$t - 1]) || !empty($completedRows[$t]),
    ];
}
echo json_encode(['rows' => $rows]);