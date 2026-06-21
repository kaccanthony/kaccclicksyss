<?php
include '../login/cnn.php';

$id = $_GET['id'] ?? '';
if (!$id) { http_response_code(404); exit; }

$stmt = mysqli_prepare($conn, "SELECT staff_avatar FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmt, "s", $id);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($res);

if (!$row || empty($row['staff_avatar'])) {
    // Try user_list
    $stmt2 = mysqli_prepare($conn, "SELECT user_avatar FROM user_list WHERE user_id = ?");
    mysqli_stmt_bind_param($stmt2, "s", $id);
    mysqli_stmt_execute($stmt2);
    $res2 = mysqli_stmt_get_result($stmt2);
    $row2 = mysqli_fetch_assoc($res2);
    if (!$row2 || empty($row2['user_avatar'])) {
        http_response_code(404); exit;
    }
    $data = $row2['user_avatar'];
} else {
    $data = $row['staff_avatar'];
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->buffer($data);
header("Content-Type: $mime");
header("Cache-Control: max-age=3600");
echo $data;