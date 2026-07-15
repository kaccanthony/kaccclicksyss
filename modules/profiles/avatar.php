<?php
// modules/profiles/avatar.php
session_start();
require_once '../../login/cnn.php';

if (!isset($_SESSION['user'])) { http_response_code(401); exit; }

$id = $_GET['id'] ?? '';
if ($id === '') { http_response_code(400); exit; }

$blob = null;

// 1. Try staff_list first
$stmt = mysqli_prepare($conn, "SELECT staff_avatar FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmt, "s", $id);
mysqli_stmt_execute($stmt);
$row = mysqli_stmt_get_result($stmt)->fetch_assoc();
if ($row && !empty($row['staff_avatar'])) {
    $blob = $row['staff_avatar'];
}

// 2. If not found, try user_list
if (!$blob) {
    $stmt = mysqli_prepare($conn, "SELECT user_avatar FROM user_list WHERE user_id = ?");
    mysqli_stmt_bind_param($stmt, "s", $id);
    mysqli_stmt_execute($stmt);
    $row = mysqli_stmt_get_result($stmt)->fetch_assoc();
    if ($row && !empty($row['user_avatar'])) {
        $blob = $row['user_avatar'];
    }
}

// 3. Still nothing → 404
if (!$blob) {
    http_response_code(404);
    exit;
}

// Output the image
$mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($blob) ?: 'image/png';
header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($blob));
header('Cache-Control: private, max-age=300');
echo $blob;