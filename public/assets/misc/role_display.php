<?php
// role_display.php
// Include this on any page, then wrap your existing $role assignment with
// formatRoleDisplay() — see usage note below.
//
// Usage:
//   require_once __DIR__ . '/../public/assets/role_display.php';
//   $role = htmlspecialchars(formatRoleDisplay($user['role'] ?? '', (int)($user['perm_level'] ?? 0)));

const ADMIN_PERM_LEVEL = 20;

function formatRoleDisplay(string $role, int $permLevel): string {
    if ($permLevel >= ADMIN_PERM_LEVEL) {
        return $role . ' - Admin';
    }
    return $role;
}