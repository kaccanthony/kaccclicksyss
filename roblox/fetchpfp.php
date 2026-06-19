<?php
// fetchpfp.php — included from login.php

$roblox_name = $_SESSION['user']['roblox_name'] ?? '';
$staff_id    = $_SESSION['user']['id'] ?? '';

if (!$roblox_name || !$staff_id) return;

// ── Helper: make HTTP GET requests via cURL ──
function roblox_get($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    curl_close($ch);
    return $res;
}

// Step 1: Get Roblox user ID
$search = roblox_get("https://api.roblox.com/users/get-by-username?username=" . urlencode($roblox_name));
$user   = json_decode($search, true);

if (empty($user['Id'])) return;

$roblox_id = $user['Id'];

// Step 2: Get avatar thumbnail
$thumb_data = roblox_get("https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={$roblox_id}&size=150x150&format=Png&isCircular=false");
$thumb      = json_decode($thumb_data, true);

$avatar_url = $thumb['data'][0]['imageUrl'] ?? null;

if (!$avatar_url) return;

// Step 3: Save to DB
$stmt = mysqli_prepare($conn, "UPDATE staff_list SET staff_avatar = ? WHERE staff_id = ?");
mysqli_stmt_bind_param($stmt, "ss", $avatar_url, $staff_id);
mysqli_stmt_execute($stmt);

// Step 4: Update session immediately
$_SESSION['user']['avatar'] = $avatar_url;