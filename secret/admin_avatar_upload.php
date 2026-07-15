<?php
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
$permLevel = (int)($_SESSION['user']['perm_level'] ?? 0);
if ($permLevel < 20) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Admin access required.']);
    exit;
}

$table = $_POST['table'] ?? '';
$id    = $_POST['id'] ?? '';
$map = [
    'staff_list' => ['col' => 'staff_avatar', 'pk' => 'staff_id'],
    'user_list'  => ['col' => 'user_avatar',  'pk' => 'user_id'],
];
if (!isset($map[$table]) || $id === '') {
    echo json_encode(['success' => false, 'message' => 'Invalid target.']);
    exit;
}
if (empty($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'No valid file uploaded.']);
    exit;
}

$allowed = ['image/png', 'image/jpeg', 'image/webp'];
$mime = mime_content_type($_FILES['avatar']['tmp_name']);
if (!in_array($mime, $allowed, true)) {
    echo json_encode(['success' => false, 'message' => 'Only PNG, JPEG, or WEBP images are allowed.']);
    exit;
}
if ($_FILES['avatar']['size'] > 2 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'Image must be under 2MB.']);
    exit;
}

$imageData = file_get_contents($_FILES['avatar']['tmp_name']);
$col = $map[$table]['col'];
$pk  = $map[$table]['pk'];

$stmt = mysqli_prepare($conn, "UPDATE `$table` SET `$col` = ? WHERE `$pk` = ?");
mysqli_stmt_bind_param($stmt, "bs", $null, $id);
mysqli_stmt_send_long_data($stmt, 0, $imageData);
$null = null;

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}