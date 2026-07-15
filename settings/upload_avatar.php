<?php
session_start();
include '../login/cnn.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['ok' => false, 'error' => 'Not logged in']);
    exit;
}

$staffId = $_SESSION['user']['id'] ?? '';
if (!$staffId) {
    echo json_encode(['ok' => false, 'error' => 'No user ID']);
    exit;
}

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['ok' => false, 'error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['avatar'];
$allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$mime = mime_content_type($file['tmp_name']);

if (!in_array($mime, $allowed)) {
    echo json_encode(['ok' => false, 'error' => 'Invalid file type']);
    exit;
}

if ($file['size'] > 5 * 1024 * 1024) {
    echo json_encode(['ok' => false, 'error' => 'File too large']);
    exit;
}

$imageData = file_get_contents($file['tmp_name']);
if ($imageData === false) {
    echo json_encode(['ok' => false, 'error' => 'Failed to read file']);
    exit;
}

// Try staff_list first, then user_list
$updated = false;
$dbError = null;

$stmtExists = mysqli_prepare($conn, "SELECT 1 FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmtExists, "s", $staffId);
mysqli_stmt_execute($stmtExists);
$inStaffList = mysqli_stmt_get_result($stmtExists)->num_rows > 0;

if ($inStaffList) {
    $stmt = mysqli_prepare($conn, "UPDATE staff_list SET staff_avatar = ? WHERE staff_id = ?");
    mysqli_stmt_bind_param($stmt, "ss", $imageData, $staffId);
    if (mysqli_stmt_execute($stmt)) {
        $updated = true; // row exists — success even if the bytes happened to match and affected_rows is 0
    } else {
        $dbError = mysqli_error($conn);
    }
} else {
    $stmt2 = mysqli_prepare($conn, "UPDATE user_list SET user_avatar = ? WHERE user_id = ?");
    if ($stmt2) {
        mysqli_stmt_bind_param($stmt2, "ss", $imageData, $staffId);
        if (mysqli_stmt_execute($stmt2) && mysqli_stmt_affected_rows($stmt2) >= 0) {
            $updated = mysqli_stmt_get_result_metadata($stmt2) !== false || true; // executed against a matching user_id
        } else {
            $dbError = mysqli_error($conn);
        }
    }
}

if (!$updated) {
    echo json_encode(['ok' => false, 'error' => $dbError ? "Database error: $dbError" : 'User not found in database']);
    exit;
}

$_SESSION['user']['avatar'] = base64_encode($imageData);
echo json_encode(['ok' => true]);