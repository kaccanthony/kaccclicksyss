<?php
session_start();
include 'cnn.php';

$error   = $_SESSION['error']   ?? '';
$success = $_SESSION['success'] ?? '';

unset($_SESSION['error'], $_SESSION['success']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    // Prepared statement to prevent SQL injection
    $stmt = mysqli_prepare($conn, "SELECT * FROM pp_staff_pp WHERE user_name = ?");
    mysqli_stmt_bind_param($stmt, "s", $username);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if (mysqli_num_rows($result) == 0) {
        $_SESSION['error'] = 'Invalid username or password';
        header('Location: login.php');
        exit;
    }

    $row = mysqli_fetch_assoc($result);

    // Verify password against Argon2id hash stored in DB
    if (!password_verify($password, $row['password_hash'])) {
        $_SESSION['error'] = 'Invalid username or password';
        header('Location: login.php');
        exit;
    }

    // Store only what's needed in session, never the hash
    $_SESSION['user'] = [
        'id'       => $row['id'],
        'username' => $row['user_name'],
    ];
    $_SESSION['success'] = 'Login successful! Redirecting…';
    header('Location: ../dashboard/dashboard.php');
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
    <link rel="stylesheet" href="login.css" />
</head>
<body>

<div id="bg-glow"></div>

<div class="card">
<h1>YSS Web App</h1>
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
    <input
        type="text"
        id="username"
        name="username"
        placeholder="your_username"
        value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
        required
        autocomplete="off"
    />
    </div>

    <div class="field">
    <label for="password">Password</label>
    <div class="pw-wrap">
        <input
        type="password"
        id="password"
        name="password"
        placeholder="••••••••"
        required
        autocomplete="current-password"
        />
        <button type="button" class="pw-toggle" id="pw-toggle" aria-label="Show password">
        <i class="fas fa-eye"></i>
        </button>
    </div>
    </div>

    <div class="forgot-row">
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
<script src="script.js"></script>
</body>
</html>