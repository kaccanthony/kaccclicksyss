<?php
session_start();
require_once '../login/cnn.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized access.']);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data || !isset($data['session_id'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data payload.']);
    exit;
}

$sessionId = (int)$data['session_id'];

// 1. Populate staff & info data fields
$updateFields = [
    'host' => $data['host'],
    'co_host1' => $data['co_host1'],
    'co_host2' => $data['co_host2'],
    'co_host3' => $data['co_host3'],
    'co_host4/supervisor' => $data['co_host4'], // match DB column name
    'assistant_1' => $data['assistant_1'],
    'assistant_2' => $data['assistant_2'],
    'assistant_3' => $data['assistant_3'],
    'assistant_4' => $data['assistant_4'],
    'session_desc' => $data['session_desc'],
    'additional_notes' => $data['additional_notes']
];

// 2. Populate trainee database column values
for ($t = 1; $t <= 10; $t++) {
    $updateFields["trainee_{$t}_name"] = !empty($data["trainee_{$t}_name"]) ? $data["trainee_{$t}_name"] : null;
    $updateFields["trainee_{$t}_zone"] = !empty($data["trainee_{$t}_zone"]) ? (int)$data["trainee_{$t}_zone"] : null;
    $updateFields["trainee_{$t}_note"] = !empty($data["trainee_{$t}_note"]) ? $data["trainee_{$t}_note"] : null;
}

// 3. Build parameterized query dynamically to prevent errors
$sqlParts = [];
$types = '';
$params = [];

foreach ($updateFields as $column => $value) {
    $sqlParts[] = "`$column` = ?";
    if (is_int($value)) {
        $types .= 'i';
    } else {
        $types .= 's';
    }
    $params[] = $value;
}

$query = "UPDATE session_upcoming SET " . implode(", ", $sqlParts) . " WHERE session_id = ?";
$types .= 'i';
$params[] = $sessionId;

$stmt = mysqli_prepare($conn, $query);

if ($stmt) {
    // Dynamic binding parameters compatible with PHP 7.2+
    $bindParams = [&$stmt, $types];
    foreach ($params as $key => $value) {
        $bindParams[] = &$params[$key];
    }
    call_user_func_array('mysqli_stmt_bind_param', $bindParams);
    
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
    }
    mysqli_stmt_close($stmt);
} else {
    echo json_encode(['success' => false, 'message' => mysqli_error($conn)]);
}