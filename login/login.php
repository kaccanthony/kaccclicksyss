<?php
ini_set('session.gc_maxlifetime', 86400);
session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();
require_once 'cnn.php';

$error    = $_SESSION['error']    ?? '';
$success  = $_SESSION['success']  ?? '';
$regError = $_SESSION['reg_error'] ?? '';
$showRegisterFace = $_SESSION['show_register'] ?? false;

unset($_SESSION['error'], $_SESSION['success'], $_SESSION['reg_error'], $_SESSION['show_register']);

if (isset($_SESSION['user'])) {
    header('Location: /dashboard/dashboard.php');
    exit;
}

// ── Remember-me cookie (staff only, unchanged) ──
if (isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];
    $stmt = mysqli_prepare($conn, "
        SELECT s.user_id, s.user_name, s.password_hash,
            l.staff_rank, l.staff_perm_level, l.staff_roblox_name
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
    setcookie('remember_token', '', time() - 3600, '/', '', true, true);
}

// ── LOGIN — checks staff first, then regular users ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_submit'])) {
    $username    = trim($_POST['username'] ?? '');
    $password    = $_POST['password'] ?? '';
    $remember_me = isset($_POST['remember_me']);

    $stmt = mysqli_prepare($conn, "
        SELECT s.user_id, s.user_name, s.password_hash,
            l.staff_rank, l.staff_perm_level, l.staff_roblox_name
        FROM pp_staff_pp s
        LEFT JOIN staff_list l ON l.staff_id = s.user_id
        WHERE s.user_name = ?
    ");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $row = mysqli_num_rows($result) > 0 ? mysqli_fetch_assoc($result) : null;
    $isStaff = $row !== null;

    // Not a staff account — try regular users
    if (!$row) {
        $stmtU = mysqli_prepare($conn, "
            SELECT u.user_id, u.user_name, u.password_hash,
                l.user_roblox_name
            FROM pp_user_pp u
            LEFT JOIN user_list l ON l.user_id = u.user_id
            WHERE u.user_name = ?
        ");
        mysqli_stmt_bind_param($stmtU, "s", $username);
        mysqli_stmt_execute($stmtU);
        $resultU = mysqli_stmt_get_result($stmtU);
        if (mysqli_num_rows($resultU) > 0) $row = mysqli_fetch_assoc($resultU);
    }

    if (!$row || !password_verify($password, $row['password_hash'])) {
        $_SESSION['error'] = 'Invalid username or password';
        header('Location: login.php');
        exit;
    }

    $_SESSION['user'] = $isStaff ? [
        'id'          => $row['user_id'],
        'username'    => $row['user_name'],
        'role'        => $row['staff_rank'],
        'perm_level'  => $row['staff_perm_level'],
        'roblox_name' => $row['staff_roblox_name'],
        'avatar'      => $row['user_id'],
        'is_staff'    => true,
    ] : [
        'id'          => $row['user_id'],
        'username'    => $row['user_name'],
        'role'        => '',
        'perm_level'  => 0,
        'roblox_name' => $row['user_roblox_name'] ?? '',
        'avatar'      => $row['user_id'],
        'is_staff'    => false,
    ];

    if ($remember_me && $isStaff) {
        $token = bin2hex(random_bytes(32));
        $stmt2 = mysqli_prepare($conn, "UPDATE pp_staff_pp SET remember_token = ? WHERE user_id = ?");
        mysqli_stmt_bind_param($stmt2, "ss", $token, $row['user_id']);
        mysqli_stmt_execute($stmt2);
        setcookie('remember_token', $token, [
            'expires'  => time() + (30 * 24 * 60 * 60),
            'path'     => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax',
        ]);
    }

    $_SESSION['success'] = 'Login successful! Redirecting…';
    header('Location: /dashboard/dashboard.php');
    exit;
}

// ── REGISTER — regular users only ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['register_submit'])) {
    $regUsername    = trim($_POST['reg_username'] ?? '');
    $regDisplayName = trim($_POST['reg_display_name'] ?? '');
    $regRoblox      = trim($_POST['reg_roblox'] ?? '');
    $regPassword    = $_POST['reg_password'] ?? '';
    $regConfirm     = $_POST['reg_confirm'] ?? '';

    $fail = function ($msg) {
        $_SESSION['reg_error']    = $msg;
        $_SESSION['show_register'] = true;
        header('Location: login.php');
        exit;
    };

    if ($regUsername === '' || $regDisplayName === '' || $regRoblox === '' || $regPassword === '') {
        $fail('Please fill in every field.');
    }
    if (strlen($regPassword) < 8) {
        $fail('Password must be at least 8 characters.');
    }
    if ($regPassword !== $regConfirm) {
        $fail('Passwords do not match.');
    }

    // Username must be unique across BOTH staff and user login tables
    $stmtCheck = mysqli_prepare($conn, "
        SELECT 1 FROM pp_staff_pp WHERE user_name = ?
        UNION SELECT 1 FROM pp_user_pp WHERE user_name = ?
    ");
    mysqli_stmt_bind_param($stmtCheck, "ss", $regUsername, $regUsername);
    mysqli_stmt_execute($stmtCheck);
    if (mysqli_stmt_get_result($stmtCheck)->num_rows > 0) {
        $fail('That username is already taken.');
    }

    $newId       = bin2hex(random_bytes(16)); // synthetic ID — this app doesn't use Discord OAuth for regular users
    $passwordHash = password_hash($regPassword, PASSWORD_DEFAULT);

    mysqli_begin_transaction($conn);
    try {
        $stmtPp = mysqli_prepare($conn, "INSERT INTO pp_user_pp (user_id, user_name, password_hash) VALUES (?, ?, ?)");
        mysqli_stmt_bind_param($stmtPp, "sss", $newId, $regUsername, $passwordHash);
        if (!mysqli_stmt_execute($stmtPp)) throw new Exception(mysqli_error($conn));

        $emptyAvatar = '';
        $stmtList = mysqli_prepare($conn, "INSERT INTO user_list
            (user_id, user_name, user_display_name, user_roblox_name, user_avatar, user_num_sesh_attend, hide_stats)
            VALUES (?, ?, ?, ?, ?, 0, 0)");
        mysqli_stmt_bind_param($stmtList, "sssss", $newId, $regUsername, $regDisplayName, $regRoblox, $emptyAvatar);
        if (!mysqli_stmt_execute($stmtList)) throw new Exception(mysqli_error($conn));

        mysqli_commit($conn);
    } catch (Exception $e) {
        mysqli_rollback($conn);
        error_log('Registration insert failed: ' . $e->getMessage()); // check your PHP error log for this
        $fail('Something went wrong creating your account. Please try again.'); // TEMP for debugging: $fail($e->getMessage());
    }

    $_SESSION['success'] = 'Account created! You can log in now.';
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="/public/assets/images/YSS Logo.png">
    <title>YSS - Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="login.css?v=<?= filemtime(__DIR__ . '/login.css') ?>" />
</head>
<body>
<div id="bg"></div>
<div id="bg-glow"></div>

<div class="container">
  <input type="checkbox" id="flip" <?= $showRegisterFace ? 'checked' : '' ?> />

  <div class="forms">

    <!-- LOGIN -->
    <div class="form-pane login-pane">
      <div class="form-inner">
        <h1>YSS Session Manager</h1>
        <p class="subtitle">Sign in to continue</p>

        <?php if ($error): ?><div class="alert alert-error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
        <?php if ($success): ?><div class="alert alert-success"><?= htmlspecialchars($success) ?></div><?php endif; ?>

        <form method="POST" action="" autocomplete="off">
            <input type="hidden" name="login_submit" value="1"/>
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
                    <button type="button" class="pw-toggle" data-target="password" aria-label="Show password">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="remember-row">
                <label class="remember-label">
                    <input type="checkbox" name="remember_me" id="remember_me" />
                    <span>Remember me</span>
                </label>
                <button type="button" id="forgot-btn">Forgot password?</button>
            </div>
            <button type="submit" class="btn-login">Sign in</button>
            <div class="switch-text">Don't have an account? <label for="flip">Register now</label></div>
        </form>
      </div>
    </div>

    <!-- REGISTER -->
    <div class="form-pane signup-pane">
      <div class="form-inner">
        <h1>Create Account</h1>
        <p class="subtitle">Register as a user</p>

        <?php if ($regError): ?><div class="alert alert-error"><?= htmlspecialchars($regError) ?></div><?php endif; ?>

        <form method="POST" action="" autocomplete="off">
            <input type="hidden" name="register_submit" value="1"/>
            <div class="field">
                <label for="reg_username">Username</label>
                <input type="text" id="reg_username" name="reg_username" placeholder="choose_a_username"
                    value="<?= htmlspecialchars($_POST['reg_username'] ?? '') ?>" required autocomplete="off" />
            </div>
            <div class="field">
                <label for="reg_display_name">Display Name</label>
                <input type="text" id="reg_display_name" name="reg_display_name" placeholder="How others see you"
                    value="<?= htmlspecialchars($_POST['reg_display_name'] ?? '') ?>" required autocomplete="off" />
            </div>
            <div class="field">
                <label for="reg_roblox">Roblox Username</label>
                <input type="text" id="reg_roblox" name="reg_roblox" placeholder="Your Roblox username"
                    value="<?= htmlspecialchars($_POST['reg_roblox'] ?? '') ?>" required autocomplete="off" />
            </div>
            <div class="field">
                <label for="reg_password">Password</label>
                <div class="pw-wrap">
                    <input type="password" id="reg_password" name="reg_password"
                        placeholder="At least 8 characters" required autocomplete="new-password" />
                    <button type="button" class="pw-toggle" data-target="reg_password" aria-label="Show password">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="field">
                <label for="reg_confirm">Confirm Password</label>
                <div class="pw-wrap">
                    <input type="password" id="reg_confirm" name="reg_confirm"
                        placeholder="Re-enter password" required autocomplete="new-password" />
                    <button type="button" class="pw-toggle" data-target="reg_confirm" aria-label="Show password">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <button type="submit" class="btn-login">Create account</button>
            <div class="switch-text">Already have an account? <label for="flip">Login now</label></div>
        </form>
      </div>
    </div>

    <!-- Sliding image + quote overlay -->
    <div class="overlay-container">
      <div class="overlay">
        <div class="overlay-panel overlay-left">
          <span class="cover-title">Welcome Back</span>
          <span class="cover-sub">"Every practice is a closer step to mastery."<br>Already have an account?</span>
          <label for="flip" class="ghost-btn">Sign In</label>
        </div>
        <div class="overlay-panel overlay-right">
          <span class="cover-title">New Here?</span>
          <span class="cover-sub">"A great signaller comes with great responsibility."<br>Join YSS today.</span>
          <label for="flip" class="ghost-btn">Register</label>
        </div>
      </div>
    </div>

  </div>
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
<?php include __DIR__ . '/../public/assets/version_badge.php'; ?>
</body>
</html>