<?php
session_start();
include '../login/cnn.php';

$id = $_GET['id'] ?? '';
$stmt = mysqli_prepare($conn, "SELECT staff_avatar FROM staff_list WHERE staff_id = ?");
mysqli_stmt_bind_param($stmt, "s", $id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($result);

if ($row && $row['staff_avatar']) {
    header('Content-Type: image/png');
    header('Cache-Control: max-age=86400');
    echo $row['staff_avatar'];
} else {
    http_response_code(404);
}