<?php

$env = parse_ini_file(__DIR__ . '/.env');

$conn = mysqli_connect($env['DB_HOST'], $env['DB_USER'], $env['DB_USER'], $env['DB_NAME']);

if (mysqli_connect_errno()) {
    echo "Failed to connect to MySQL: " . mysqli_connect_error();
}
?>