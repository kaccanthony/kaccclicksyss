<?php
include '../login/cnn.php';

$username = 'Yoshi5336';
$password = 'eQudR82cV9MF';
$stmt = mysqli_prepare($conn, "
    SELECT s.user_id, s.user_name, s.password_hash,
        l.staff_rank, l.staff_perm_level, l.staff_roblox_name
    FROM pp_staff_pp s
    LEFT JOIN staff_list l ON l.staff_id = s.user_id
    WHERE s.user_name = ?
");
mysqli_stmt_bind_param($stmt, "s", $username);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

echo $result;
?>