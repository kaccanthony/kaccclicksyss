<?php
// manage_records.php
session_start();
require_once '../login/cnn.php';
require_once __DIR__ . '/managestaff_tables.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$permLevel = (int)($_SESSION['user']['perm_level'] ?? 0);
if ($permLevel < 15) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Manager or Admin access required.']);
    exit;
}

$config = getTableConfig();
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$table = $_GET['table'] ?? $body['table'] ?? '';
if (!isset($config[$table]) || !empty($config[$table]['comingSoon'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown or unavailable table.']);
    exit;
}
$tableConfig = $config[$table];

if (!empty($tableConfig['minLevel']) && $permLevel < $tableConfig['minLevel']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Insufficient permission for this table.']);
    exit;
}

$pk = $tableConfig['primaryKey'];
$columns = $tableConfig['columns'] ?? [];

// ── LIST ──────────────────────────────────────────────────────────
if ($method === 'GET') {
    $colNames = array_keys($columns);
    $colList = implode(', ', array_map(fn($c) => "`$c`", $colNames));
    $res = mysqli_query($conn, "SELECT $colList FROM `$table` ORDER BY `$pk` DESC LIMIT 500");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['success' => true, 'rows' => $rows]);
    exit;
}

if (!empty($tableConfig['readOnly'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => $tableConfig['readOnlyReason'] ?? 'This table is read-only here.']);
    exit;
}

// ── CREATE ────────────────────────────────────────────────────────
if ($method === 'POST') {
    $data = $body['data'] ?? [];
    $sets = []; $types = ''; $params = [];
    foreach ($columns as $col => $def) {
        if (($def['editableOnCreate'] ?? true) === false && $col !== $pk) continue;
        if (!empty($def['minLevel']) && $permLevel < $def['minLevel']) continue;
        if (!array_key_exists($col, $data)) continue;
        $val = $data[$col];
        if (($def['type'] ?? '') === 'bool') $val = !empty($val) ? 1 : 0;
        $sets[] = "`$col`";
        $types .= (($def['type'] ?? '') === 'number' || ($def['type'] ?? '') === 'bool') ? 'i' : 's';
        $params[] = $val;
    }
    if (!$sets) {
        echo json_encode(['success' => false, 'message' => 'No valid fields supplied.']);
        exit;
    }
    $placeholders = implode(', ', array_fill(0, count($sets), '?'));
    $sql = "INSERT INTO `$table` (" . implode(', ', $sets) . ") VALUES ($placeholders)";
    $stmt = mysqli_prepare($conn, $sql);
    $bind = [$stmt, $types];
    foreach ($params as $k => $v) $bind[] = &$params[$k];
    call_user_func_array('mysqli_stmt_bind_param', $bind);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
    }
    exit;
}

// ── UPDATE ────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $pkVal = $body['pk'] ?? null;
    $data = $body['data'] ?? [];
    if ($pkVal === null) {
        echo json_encode(['success' => false, 'message' => 'Missing primary key value.']);
        exit;
    }
    $sets = []; $types = ''; $params = [];
    foreach ($columns as $col => $def) {
        if ($col === $pk) continue; // never update the primary key itself here
        if (($def['editableOnUpdate'] ?? true) === false) continue;
        if (!empty($def['minLevel']) && $permLevel < $def['minLevel']) continue;
        if (!array_key_exists($col, $data)) continue;
        $val = $data[$col];
        if (($def['type'] ?? '') === 'bool') $val = !empty($val) ? 1 : 0;
        $sets[] = "`$col` = ?";
        $types .= (($def['type'] ?? '') === 'number' || ($def['type'] ?? '') === 'bool') ? 'i' : 's';
        $params[] = $val;
    }
    if (!$sets) {
        echo json_encode(['success' => false, 'message' => 'No editable fields supplied.']);
        exit;
    }
    $types .= (is_int($pkVal) ? 'i' : 's');
    $params[] = $pkVal;
    $sql = "UPDATE `$table` SET " . implode(', ', $sets) . " WHERE `$pk` = ?";
    $stmt = mysqli_prepare($conn, $sql);
    $bind = [$stmt, $types];
    foreach ($params as $k => $v) $bind[] = &$params[$k];
    call_user_func_array('mysqli_stmt_bind_param', $bind);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
    }
    exit;
}

// ── DELETE ────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $pkVal = $body['pk'] ?? null;
    if ($pkVal === null) {
        echo json_encode(['success' => false, 'message' => 'Missing primary key value.']);
        exit;
    }
    $stmt = mysqli_prepare($conn, "DELETE FROM `$table` WHERE `$pk` = ?");
    $type = is_int($pkVal) ? 'i' : 's';
    mysqli_stmt_bind_param($stmt, $type, $pkVal);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed.']);