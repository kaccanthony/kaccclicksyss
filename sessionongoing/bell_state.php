<?php
// bell.php — per-session shared bell state (Host/Co-host/Assistant), scoped by session_id.
// GET  ?session_id=123           -> returns current state for that session
// POST { session_id, action: 'ring'|'ack', role: 'host'|'cohost'|'assistant', client_id }
session_start();
require_once '../login/cnn.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

const ACK_TIMEOUT_SECONDS      = 30;
const COOLDOWN_SECONDS         = 300;
const MAX_INITIATIONS_PER_USER = 3;

function defaultState() {
    return [
        'active'            => false,
        'initiator_role'    => null,
        'initiator_client'  => null,
        'acks'              => ['host' => false, 'cohost' => false, 'assistant' => false],
        'ring_started_at'   => null,
        'cooldown_until'    => null,
        'initiation_counts' => [],
        'updated_at'        => time(),
    ];
}

function loadState($file) {
    if (!file_exists($file)) return defaultState();
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? array_merge(defaultState(), $data) : defaultState();
}

function saveState($file, $state) {
    $state['updated_at'] = time();
    file_put_contents($file, json_encode($state), LOCK_EX);
    return $state;
}

$method = $_SERVER['REQUEST_METHOD'];
$body = $method === 'POST' ? (json_decode(file_get_contents('php://input'), true) ?: []) : [];
$sessionId = (int)($_GET['session_id'] ?? $body['session_id'] ?? 0);
if ($sessionId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing session_id.']);
    exit;
}

$stateFile = __DIR__ . "/bell_session_{$sessionId}.json";
$lockFile  = __DIR__ . "/bell_session_{$sessionId}.lock";

$fp = fopen($lockFile, 'c');
flock($fp, LOCK_EX);

$state = loadState($stateFile);
$now = time();

if ($state['cooldown_until'] !== null && $now >= $state['cooldown_until']) {
    $state = defaultState();
}
if ($state['active'] && $state['ring_started_at'] !== null && ($now - $state['ring_started_at']) > ACK_TIMEOUT_SECONDS) {
    $state['active'] = false;
    $state['cooldown_until'] = $now + COOLDOWN_SECONDS;
}

if ($method === 'GET') {
    $state = saveState($stateFile, $state);
    flock($fp, LOCK_UN);
    echo json_encode($state);
    exit;
}

if ($method === 'POST') {
    $action   = $body['action'] ?? '';
    $role     = $body['role'] ?? '';
    $clientId = $body['client_id'] ?? '';

    if ($action === 'ring') {
        if (!in_array($role, ['host', 'cohost'], true)) {
            http_response_code(403);
            echo json_encode(['error' => 'Only Host or Co-host can start the bell.']);
            exit;
        }
        if ($state['active']) {
            http_response_code(409);
            echo json_encode(['error' => 'A bell is already active.']);
            exit;
        }
        if ($state['cooldown_until'] !== null && $now < $state['cooldown_until']) {
            http_response_code(409);
            echo json_encode(['error' => 'Bell system is cooling down.']);
            exit;
        }
        $count = $state['initiation_counts'][$clientId] ?? 0;
        if ($count >= MAX_INITIATIONS_PER_USER) {
            http_response_code(403);
            echo json_encode(['error' => 'You have reached the bell limit until the next reset.']);
            exit;
        }
        $state['active']           = true;
        $state['initiator_role']   = $role;
        $state['initiator_client'] = $clientId;
        $state['acks']             = ['host' => false, 'cohost' => false, 'assistant' => false];
        $state['acks'][$role]      = true;
        $state['ring_started_at']  = $now;
        $state['initiation_counts'][$clientId] = $count + 1;
        $state = saveState($stateFile, $state);
        flock($fp, LOCK_UN);
        echo json_encode($state);
        exit;
    }

    if ($action === 'ack') {
        if (!$state['active']) {
            http_response_code(409);
            echo json_encode(['error' => 'No active bell to acknowledge.']);
            exit;
        }
        if (!in_array($role, ['host', 'cohost', 'assistant'], true) || $role === $state['initiator_role']) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid acknowledgment.']);
            exit;
        }
        $state['acks'][$role] = true;
        $requiredRoles = array_diff(['host', 'cohost', 'assistant'], [$state['initiator_role']]);
        $allAcked = true;
        foreach ($requiredRoles as $r) {
            if (!$state['acks'][$r]) { $allAcked = false; break; }
        }
        if ($allAcked) {
            $state['active']         = false;
            $state['cooldown_until'] = $now + COOLDOWN_SECONDS;
        }
        $state = saveState($stateFile, $state);
        flock($fp, LOCK_UN);
        echo json_encode($state);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action.']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed.']);