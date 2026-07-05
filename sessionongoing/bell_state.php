<?php
// bell_state.php — lightweight shared state for the Host/Co-host/Assistant bell system.
// GET  -> returns current state (also runs expiry/timeout checks)
// POST -> { action: 'ring'|'ack', role: 'host'|'cohost'|'assistant', client_id: '...' }

header('Content-Type: application/json');

$stateFile = __DIR__ . '/bell_state.json';
$lockFile  = __DIR__ . '/bell_state.lock';

const ACK_TIMEOUT_SECONDS      = 30;   // if no ack within this long, cycle ends and cooldown starts anyway
const COOLDOWN_SECONDS         = 300;  // 5 minutes
const MAX_INITIATIONS_PER_USER = 3;    // per client_id, resets when cooldown fully expires

function defaultState() {
    return [
        'active'             => false,
        'initiator_role'     => null,     // 'host' | 'cohost' | null
        'initiator_client'   => null,
        'acks'               => ['host' => false, 'cohost' => false, 'assistant' => false],
        'ring_started_at'    => null,
        'cooldown_until'     => null,
        'initiation_counts'  => [],        // client_id => count
        'updated_at'         => time(),
    ];
}

function loadState($stateFile) {
    if (!file_exists($stateFile)) return defaultState();
    $data = json_decode(file_get_contents($stateFile), true);
    return is_array($data) ? array_merge(defaultState(), $data) : defaultState();
}

function saveState($stateFile, $state) {
    $state['updated_at'] = time();
    file_put_contents($stateFile, json_encode($state), LOCK_EX);
    return $state;
}

$fp = fopen($lockFile, 'c');
flock($fp, LOCK_EX);

$state = loadState($stateFile);
$now = time();

// Full reset once cooldown fully expires (also clears per-user initiation counts)
if ($state['cooldown_until'] !== null && $now >= $state['cooldown_until']) {
    $state = defaultState();
}
// Ack timeout — nobody responded in time, end the cycle and start cooldown anyway
if ($state['active'] && $state['ring_started_at'] !== null && ($now - $state['ring_started_at']) > ACK_TIMEOUT_SECONDS) {
    $state['active'] = false;
    $state['cooldown_until'] = $now + COOLDOWN_SECONDS;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $state = saveState($stateFile, $state);
    flock($fp, LOCK_UN);
    echo json_encode($state);
    exit;
}

if ($method === 'POST') {
    $input    = json_decode(file_get_contents('php://input'), true) ?: [];
    $action   = $input['action'] ?? '';
    $role     = $input['role'] ?? '';
    $clientId = $input['client_id'] ?? '';

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
        $state['acks'][$role]      = true; // initiator's own slot is implicitly "acked" (it's ringing, not waiting)
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
fclose($fp);