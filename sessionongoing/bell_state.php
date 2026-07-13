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

const ACK_TIMEOUT_SECONDS   = 30;   // measured from the FIRST ring of the cycle — re-rings don't reset this
const COOLDOWN_SECONDS      = 300;
const MAX_RINGS_PER_CYCLE   = 3;    // total rings (including the first) allowed within one active cycle
const RING_SPACING_SECONDS  = 5;    // minimum gap between consecutive rings in the same cycle

function defaultState() {
    return [
        'active'            => false,
        'initiator_role'    => null,
        'initiator_client'  => null,
        'acks'              => ['host' => false, 'cohost' => false, 'assistant' => false],
        'ring_started_at'   => null,  // timestamp of the FIRST ring — never changes across re-rings
        'last_ring_at'      => null,  // timestamp of the MOST RECENT ring — gates the 5s spacing
        'ring_count'        => 0,
        'cooldown_until'    => null,
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

// Determine which roles actually exist in this session, so the ack requirement never
// waits on a role that has nobody in it (e.g. host-only sessions with no co-host/assistant).
$stmtSess = mysqli_prepare($conn, "SELECT co_host1, co_host2, co_host3, `co_host4/supervisor`, assistant_1, assistant_2, assistant_3, assistant_4 FROM session_ongoing WHERE session_id = ?");
mysqli_stmt_bind_param($stmtSess, "i", $sessionId);
mysqli_stmt_execute($stmtSess);
$sessRow = mysqli_stmt_get_result($stmtSess)->fetch_assoc();
$hasCohost = $sessRow && (!empty($sessRow['co_host1']) || !empty($sessRow['co_host2']) || !empty($sessRow['co_host3']) || !empty($sessRow['co_host4/supervisor']));
$hasAssistant = $sessRow && (!empty($sessRow['assistant_1']) || !empty($sessRow['assistant_2']) || !empty($sessRow['assistant_3']) || !empty($sessRow['assistant_4']));
$rolesInSession = ['host'];
if ($hasCohost) $rolesInSession[] = 'cohost';
if ($hasAssistant) $rolesInSession[] = 'assistant';

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
        if ($state['cooldown_until'] !== null && $now < $state['cooldown_until']) {
            http_response_code(409);
            echo json_encode(['error' => 'Bell system is cooling down.']);
            exit;
        }

        if (!$state['active']) {
            // Starting a brand new cycle.
            $state['active']           = true;
            $state['initiator_role']   = $role;
            $state['initiator_client'] = $clientId;
            $state['acks']             = ['host' => false, 'cohost' => false, 'assistant' => false];
            $state['acks'][$role]      = true;
            $state['ring_started_at']  = $now;
            $state['last_ring_at']     = $now;
            $state['ring_count']       = 1;

            // If nobody else needs to ack (e.g. host rings in a session with no co-host and no
            // assistant at all), close the cycle immediately instead of leaving it hanging.
            $requiredNow = array_diff($rolesInSession, [$role]);
            if (empty($requiredNow)) {
                $state['active']         = false;
                $state['cooldown_until'] = $now + COOLDOWN_SECONDS;
            }
        } else {
            // Re-ringing an already-active cycle — only the original initiator may nudge again.
            if ($role !== $state['initiator_role']) {
                http_response_code(403);
                echo json_encode(['error' => 'Only the person who started this bell can ring it again.']);
                exit;
            }
            if ($state['ring_count'] >= MAX_RINGS_PER_CYCLE) {
                http_response_code(409);
                echo json_encode(['error' => 'No more re-rings left for this bell — waiting on acknowledgment or timeout.']);
                exit;
            }
            $secondsSinceLastRing = $now - $state['last_ring_at'];
            if ($secondsSinceLastRing < RING_SPACING_SECONDS) {
                http_response_code(429);
                echo json_encode(['error' => 'Please wait ' . (RING_SPACING_SECONDS - $secondsSinceLastRing) . 's before ringing again.']);
                exit;
            }
            $state['ring_count']++;
            $state['last_ring_at'] = $now;
            // ring_started_at is deliberately untouched — the 30s ack deadline is fixed to the first ring.
        }

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
        $requiredRoles = array_diff($rolesInSession, [$state['initiator_role']]);
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