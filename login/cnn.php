<?php
$hostname = "sql200.infinityfree.com";
$dbuser = "if0_42191862";
$password = "ntp8msDsPaYbXP";
$dbname = "if0_42191862_yss_db";
$conn = mysqli_connect($hostname, $dbuser, $password, $dbname);

if (mysqli_connect_errno()) {
    echo "Failed to connect to MySQL: " . mysqli_connect_error();
}
?>