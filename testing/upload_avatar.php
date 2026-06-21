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

$stmt = mysqli_prepare($conn, "UPDATE staff_list SET staff_avatar = ? WHERE staff_id = ?");
if ($stmt) {
    mysqli_stmt_bind_param($stmt, "ss", $imageData, $staffId);
    mysqli_stmt_execute($stmt);
    if (mysqli_stmt_affected_rows($stmt) > 0) {
        $updated = true;
    }
}

if (!$updated) {
    $stmt2 = mysqli_prepare($conn, "UPDATE user_list SET user_avatar = ? WHERE user_id = ?");
    if ($stmt2) {
        mysqli_stmt_bind_param($stmt2, "ss", $imageData, $staffId);
        mysqli_stmt_execute($stmt2);
        if (mysqli_stmt_affected_rows($stmt2) > 0) {
            $updated = true;
        }
    }
}

if (!$updated) {
    echo json_encode(['ok' => false, 'error' => 'User not found in database']);
    exit;
}

$_SESSION['user']['avatar'] = base64_encode($imageData);
echo json_encode(['ok' => true]);