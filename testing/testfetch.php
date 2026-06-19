<?php
include '../login/cnn.php';

echo "allow_url_fopen: " . (ini_get('allow_url_fopen') ? '✅ enabled' : '❌ disabled') . "<br>";

$test = @file_get_contents("https://api.roblox.com/users/get-by-username?username=Yoshi5336");
echo "API response: " . ($test ? $test : '❌ failed / blocked') . "<br>";
?>