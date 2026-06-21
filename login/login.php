<?php
session_start();
require_once '/conf/cnn.php';

$error   = $_SESSION['error']   ?? '';
$success = $_SESSION['success'] ?? '';

unset($_SESSION['error'], $_SESSION['success']);

// ── If already logged in via session or cookie, skip login ──
if (isset($_SESSION['user'])) {
    header('Location: /dashboard/dashboard.php');
    exit;
}

// ── Check remember me cookie ──
if (isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];

    $stmt = mysqli_prepare($conn, "
        SELECT s.user_id, s.user_name, s.password_hash,
            l.staff_rank, l.staff_perm_level, l.staff_roblox_name, 
            l.staff_avatar, l.display_name, l.discord_username
        FROM pp_staff_pp s
        LEFT JOIN staff_list l ON l.staff_id = s.user_id
        WHERE s.remember_token = ?
    ");
    mysqli_stmt_bind_param($stmt, "s", $token);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if (mysqli_num_rows($result) > 0) {
        $row = mysqli_fetch_assoc($result);
        $_SESSION['user'] = [
            'id'          => $row['user_id'],
            'username'    => $row['user_name'],
            'role'        => $row['staff_rank'],
            'perm_level'  => $row['staff_perm_level'],
            'roblox_name' => $row['staff_roblox_name'],
            'avatar'      => $row['user_id'],
        ];
        header('Location: /dashboard/dashboard.php');
        exit;
    }

    // Token invalid — clear it
    setcookie('remember_token', '', time() - 3600, '/', '', true, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username    = trim($_POST['username'] ?? '');
    $password    = $_POST['password'] ?? '';
    $remember_me = isset($_POST['remember_me']);

    $stmt = mysqli_prepare($conn, "
        SELECT s.user_id, s.user_name, s.password_hash,
            l.staff_rank, l.staff_perm_level, l.staff_roblox_name, l.staff_avatar
        FROM pp_staff_pp s
        LEFT JOIN staff_list l ON l.staff_id = s.user_id
        WHERE s.user_name = ?
    ");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if (mysqli_num_rows($result) == 0) {
        $_SESSION['error'] = 'Invalid username or password';
        header('Location: login.php');
        exit;
    }

    $row = mysqli_fetch_assoc($result);

    if (!password_verify($password, $row['password_hash'])) {
        $_SESSION['error'] = 'Invalid username or password';
        header('Location: login.php');
        exit;
    }

    $_SESSION['user'] = [
        'id'          => $row['user_id'],
        'username'    => $row['user_name'],
        'role'        => $row['staff_rank'],
        'perm_level'  => $row['staff_perm_level'],
        'roblox_name' => $row['staff_roblox_name'],
        'avatar'      => $row['user_id'],
    ];

    // ── Set remember me cookie ──
    if ($remember_me) {
        $token = bin2hex(random_bytes(32)); // secure random token

        // Save token to DB
        $stmt2 = mysqli_prepare($conn, "UPDATE pp_staff_pp SET remember_token = ? WHERE user_id = ?");
        mysqli_stmt_bind_param($stmt2, "ss", $token, $row['user_id']);
        mysqli_stmt_execute($stmt2);

        // Set cookie for 30 days
        setcookie('remember_token', $token, [
            'expires'  => time() + (30 * 24 * 60 * 60),
            'path'     => '/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    $_SESSION['success'] = 'Login successful! Redirecting…';
    header('Location: /dashboard/dashboard.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="../icons/YSS Logo.png">
    <title>YSS - Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="login.css?v=<?= filemtime(__DIR__ . '/login.css') ?>" />
</head>
<body>
<div id="bg"></div>
<div id="bg-glow"></div>

<div class="card">
<h1>YSS Session Manager</h1>
<p class="subtitle">Sign in to continue</p>

<?php if ($error): ?>
    <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>
<?php if ($success): ?>
    <div class="alert alert-success"><?= htmlspecialchars($success) ?></div>
<?php endif; ?>

<form method="POST" action="" autocomplete="off">
    <div class="field">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="your_username"
            value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
            required autocomplete="off" />
    </div>

    <div class="field">
        <label for="password">Password</label>
        <div class="pw-wrap">
            <input type="password" id="password" name="password"
                placeholder="••••••••" required autocomplete="current-password" />
            <button type="button" class="pw-toggle" id="pw-toggle" aria-label="Show password">
                <i class="fas fa-eye"></i>
            </button>
        </div>
    </div>

    <!-- ── Remember me ── -->
    <div class="remember-row">
        <label class="remember-label">
            <input type="checkbox" name="remember_me" id="remember_me" />
            <span>Remember me</span>
        </label>
        <button type="button" id="forgot-btn">Forgot password?</button>
    </div>

    <button type="submit" class="btn-login">Sign in</button>
</form>
</div>

<div class="modal-backdrop" id="modal-backdrop">
    <div class="modal">
        <strong>Need help?</strong>
        <p>Contact <b>kacc</b> in DISCORD to reset/change your password.</p>
        <button class="modal-close" id="modal-close">Got it</button>
    </div>
</div>
<script src="https://kit.fontawesome.com/6c33013ae6.js" crossorigin="anonymous"></script>
<script src="login.js"></script>
</body>
</html>