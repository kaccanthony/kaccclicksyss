<?php
session_start();
include '../login/cnn.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['ok' => false, 'error' => 'Not logged in']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['ok' => false, 'error' => 'Invalid request']);
    exit;
}

$oldPw  = $input['old_password'] ?? '';
$newPw  = $input['new_password'] ?? '';
$rePw   = $input['re_password']  ?? '';
$userId = $_SESSION['user']['id'] ?? '';

if (!$oldPw || !$newPw || !$rePw) {
    echo json_encode(['ok' => false, 'error' => 'All fields are required']);
    exit;
}
if ($newPw !== $rePw) {
    echo json_encode(['ok' => false, 'error' => 'New passwords do not match']);
    exit;
}
if (strlen($newPw) < 8) {
    echo json_encode(['ok' => false, 'error' => 'Password must be at least 8 characters']);
    exit;
}

// Fetch current hash from pp_staff_pp
$stmt = mysqli_prepare($conn, "SELECT password_hash FROM pp_staff_pp WHERE user_id = ?");
mysqli_stmt_bind_param($stmt, "s", $userId);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($res);

if (!$row) {
    // Try pp_user_pp
    $stmt2 = mysqli_prepare($conn, "SELECT password_hash FROM pp_user_pp WHERE user_id = ?");
    mysqli_stmt_bind_param($stmt2, "s", $userId);
    mysqli_stmt_execute($stmt2);
    $res2 = mysqli_stmt_get_result($stmt2);
    $row = mysqli_fetch_assoc($res2);
    $table = 'pp_user_pp';
} else {
    $table = 'pp_staff_pp';
}

if (!$row) {
    echo json_encode(['ok' => false, 'error' => 'Account not found']);
    exit;
}

if (!password_verify($oldPw, $row['password_hash'])) {
    echo json_encode(['ok' => false, 'error' => 'Current password is incorrect']);
    exit;
}

$newHash = password_hash($newPw, PASSWORD_ARGON2ID, ['memory_cost' => 16, 'time_cost' => 2, 'threads' => 1]);

$stmt3 = mysqli_prepare($conn, "UPDATE $table SET password_hash = ? WHERE user_id = ?");
mysqli_stmt_bind_param($stmt3, "ss", $newHash, $userId);
mysqli_stmt_execute($stmt3);

echo json_encode(['ok' => true]);