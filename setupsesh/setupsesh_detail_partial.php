<?php
// Prevent session start errors if already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 1. Define the rendering function
if (!function_exists('renderDetailPanel')) {
    function renderDetailPanel(array $s, array $staffByRank = [], array $assistRanks = [], array $cohostRanks = [], array $hostRanks = []): string {
        $timeFormatted = date('g:i A', strtotime($s['session_time']));
        $slotsFilled = 0;
        for ($t = 1; $t <= 10; $t++) {
            if (!empty($s["trainee_{$t}_name"])) $slotsFilled++;
        }
        $trainees = [];
        for ($t = 1; $t <= 10; $t++) {
            if (!empty($s["trainee_{$t}_name"])) {
                $trainees[] = [
                    'name' => $s["trainee_{$t}_name"],
                    'zone' => $s["trainee_{$t}_zone"] ?? '',
                    'note' => $s["trainee_{$t}_note"] ?? '',
                ];
            }
        }
        ob_start();
        ?>
        <div class="detail-header">
            <div class="detail-status detail-status--<?= strtolower(htmlspecialchars($s['session_status'])) ?>">
                <?= htmlspecialchars($s['session_status']) ?>
            </div>
            <h2 class="detail-name"><?= htmlspecialchars($s['session_name'] ?: 'Unnamed Session') ?></h2>
            <div class="detail-time-row">
                <span><i class="fas fa-clock"></i> <?= htmlspecialchars($timeFormatted) ?></span>
                <span><i class="fas fa-hourglass-half"></i> <?= htmlspecialchars($s['session_duration']) ?> min</span>
                <span><i class="fas fa-id-badge"></i> #<?= (int)$s['session_id'] ?></span>
            </div>
        </div>

        <div class="detail-stats">
            <div class="dstat">
                <div class="dstat-val"><?= $slotsFilled ?>/<?= (int)$s['num_slots'] ?></div>
                <div class="dstat-label">Trainees</div>
            </div>
            <div class="dstat">
                <div class="dstat-val"><?= htmlspecialchars($s['session_duration']) ?>m</div>
                <div class="dstat-label">Duration</div>
            </div>
            <div class="dstat">
                <div class="dstat-val"><?= htmlspecialchars($s['session_time']) ?></div>
                <div class="dstat-label">Start Time</div>
            </div>
        </div>

        <?php if (!empty($s['session_desc'])): ?>
        <div class="detail-desc"><?= nl2br(htmlspecialchars($s['session_desc'])) ?></div>
        <?php endif; ?>

        <!-- Assigned staff quick view -->
        <div class="detail-section">
            <div class="detail-section-label">Host & Staff</div>
            <div class="detail-staff-chips">
                <?php
                $staffFields = [
                    'host'            => ['icon' => 'fa-crown',    'label' => 'Host'],
                    'co_host1'        => ['icon' => 'fa-user-tie', 'label' => 'Co-Host'],
                    'co_host2'        => ['icon' => 'fa-user-tie', 'label' => 'Co-Host'],
                    'co_host3'        => ['icon' => 'fa-user-tie', 'label' => 'Co-Host'],
                    'co_host4'        => ['icon' => 'fa-user-gear', 'label' => 'Supervisor'],
                    'assistant_1'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                    'assistant_2'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                    'assistant_3'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                    'assistant_4'     => ['icon' => 'fa-user',     'label' => 'Asst'],
                ];
                foreach ($staffFields as $field => $meta):
                    $val = $s[$field] ?? '';
                    if (empty($val)) continue;
                ?>
                <span class="staff-chip">
                    <i class="fas <?= $meta['icon'] ?>"></i>
                    <?= htmlspecialchars($val) ?>
                    <span class="staff-chip-role"><?= $meta['label'] ?></span>
                </span>
                <?php endforeach; ?>
                <?php if (empty(array_filter(array_map(fn($f) => $s[$f] ?? '', array_keys($staffFields))))): ?>
                    <span class="no-staff-msg">No staff assigned yet</span>
                <?php endif; ?>
            </div>
        </div>

        <!-- Trainee list -->
        <?php if (!empty($trainees)): ?>
        <div class="detail-section">
            <div class="detail-section-label">Trainees (<?= count($trainees) ?>)</div>
            <div class="trainee-chips">
                <?php foreach ($trainees as $tr): ?>
                <div class="trainee-chip">
                    <div class="trainee-chip-avatar"><i class="fas fa-graduation-cap"></i></div>
                    <div class="trainee-chip-info">
                        <div class="trainee-chip-name"><?= htmlspecialchars($tr['name']) ?></div>
                        <?php if (!empty($tr['zone'])): ?>
                        <div class="trainee-chip-zone">Zone <?= htmlspecialchars($tr['zone']) ?></div>
                        <?php endif; ?>
                    </div>
                    <?php if (!empty($tr['note'])): ?>
                    <div class="trainee-chip-note" title="<?= htmlspecialchars($tr['note']) ?>">
                        <i class="fas fa-note-sticky"></i>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <div class="detail-actions">
            <button class="btn-setup" onclick="openSetupModal(<?= $s['session_id'] ?>)">
                <i class="fas fa-play"></i> Setup Session
            </button>
        </div>
        <?php
        return ob_get_clean();
    }
}

// 2. AJAX Endpoint: If Javascript calls this script directly
if (isset($_GET['session_id']) && !defined('IN_MAIN_SCRIPT')) {
    require_once '../login/cnn.php';
    
    if (!isset($_SESSION['user'])) {
        http_response_code(401);
        exit('Unauthorized');
    }

    $sessionId = (int)$_GET['session_id'];
    
    $stmt = mysqli_prepare($conn, "SELECT * FROM session_upcoming WHERE session_id = ?");
    mysqli_stmt_bind_param($stmt, "i", $sessionId);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    $session = mysqli_fetch_assoc($res);

    if ($session) {
        echo renderDetailPanel($session);
    } else {
        http_response_code(404);
        echo 'Session not found.';
    }
}