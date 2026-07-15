<?php
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false]);
    exit;
}

$offset = max(0, (int)($_GET['offset'] ?? 0));
$limit  = 7;

$stmt = mysqli_prepare($conn, "SELECT notif_id, category, title, description, posted_at FROM notifications ORDER BY posted_at DESC LIMIT ? OFFSET ?");
mysqli_stmt_bind_param($stmt, "ii", $limit, $offset);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$rows = [];
while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;

echo json_encode(['success' => true, 'rows' => $rows]);