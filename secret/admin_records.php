<?php
// manage_records.php
session_start();
require_once '../login/cnn.php';
require_once __DIR__ . '/admin_tables.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$permLevel = (int)($_SESSION['user']['perm_level'] ?? 0);
if ($permLevel < 20) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Admin access required.']);
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
    // 'password' and 'avatar' columns are never sent to the client — passwords stay
    // server-side entirely, and avatars are large blobs served separately via avatar.php.
    $colNames = array_keys(array_filter($columns, fn($def) => !in_array($def['type'] ?? '', ['password', 'avatar'], true)));
    $colList = implode(', ', array_map(fn($c) => "`$c`", $colNames));
    $res = mysqli_query($conn, "SELECT $colList FROM `$table` ORDER BY `$pk` DESC LIMIT 500");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    // Presence flag only — never the actual value — so the UI can still show "•••••••• (set)"
    if (in_array('password', array_column($columns, 'type'), true)) {
        foreach ($rows as &$r) $r['_has_password'] = true; // password_hash is NOT NULL in this schema
    }
    unset($r);
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
        $type = $def['type'] ?? '';
        if ($type === 'avatar') continue; // handled by the dedicated upload endpoint, not here
        if ($type === 'password') {
            if (trim((string)$val) === '') continue; // no password supplied on create — skip, don't insert an empty hash
            $val = password_hash($val, PASSWORD_ARGON2ID);
        }
        if ($type === 'bool') $val = !empty($val) ? 1 : 0;
        $sets[] = "`$col`";
        $types .= ($type === 'number' || $type === 'bool') ? 'i' : 's';
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

    // Row-specific guard, Staff Directory only: once a staff member is already Manager/Admin
    // rank (perm 15+), only an Admin (level 20) may change their staff_rank. This depends on
    // the TARGET row's current data, not a fixed column minLevel, so it lives here rather than
    // in the table config.
    $targetPermLevel = null;
    if ($table === 'staff_list') {
        $stmtTarget = mysqli_prepare($conn, "SELECT staff_perm_level FROM staff_list WHERE staff_id = ?");
        mysqli_stmt_bind_param($stmtTarget, "s", $pkVal);
        mysqli_stmt_execute($stmtTarget);
        $targetRow = mysqli_stmt_get_result($stmtTarget)->fetch_assoc();
        $targetPermLevel = $targetRow ? (int)$targetRow['staff_perm_level'] : null;
    }

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
        if ($table === 'staff_list' && $col === 'staff_rank' && $targetPermLevel !== null && $targetPermLevel >= 15 && $permLevel < 20) continue;
        if (!array_key_exists($col, $data)) continue;
        $val = $data[$col];
        $type = $def['type'] ?? '';
        if ($type === 'avatar') continue; // handled by the dedicated upload endpoint, not here
        if ($type === 'password') {
            if (trim((string)$val) === '') continue; // left blank = keep the existing password unchanged
            $val = password_hash($val, PASSWORD_ARGON2ID);
        }
        if ($type === 'bool') $val = !empty($val) ? 1 : 0;
        $sets[] = "`$col` = ?";
        $types .= ($type === 'number' || $type === 'bool') ? 'i' : 's';
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