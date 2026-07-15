<?php
// managestaff_tables.php
// Central config: every board (table) Manage Staff can show, and exactly which
// columns are visible/editable. manage_records.php ONLY ever touches a table/column
// that appears here — nothing from the client can reach raw SQL identifiers.

function getTableConfig(): array {
    return [
        // ── Staff Management ─────────────────────────────────────
        'staff_list' => [
            'label' => 'Staff Directory', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'staff_id', 'displayMode' => 'table',
            'columns' => [
                'staff_id'             => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'staff_name'           => ['label' => 'Discord Username', 'type' => 'text'],
                'staff_display_name'   => ['label' => 'Display Name', 'type' => 'text'],
                'staff_avatar' => ['label' => 'Avatar', 'type' => 'avatar'],
                'staff_roblox_name'    => ['label' => 'Roblox Username', 'type' => 'text'],
                'staff_nationality'    => ['label' => 'Nationality', 'type' => 'text'],
                'staff_rank'           => ['label' => 'Rank', 'type' => 'select', 'pill' => true,
                    'options' => ['Community Manager', 'Operations Manager', 'Head Staff', 'Co-Host Authorized', 'Assistant Authorized', 'Event Authorized']],
                'staff_days'           => ['label' => 'Days as Staff', 'type' => 'number'],
                'staff_num_sesh_attend'=> ['label' => 'Sessions Attended', 'type' => 'number'],
                'staff_joined'         => ['label' => 'Joined', 'type' => 'date'],
                'staff_loa'            => ['label' => 'On LOA', 'type' => 'bool'],
                'staff_quota'          => ['label' => 'Quota Met', 'type' => 'bool'],
                'staff_perm_level'     => ['label' => 'Perm Level', 'type' => 'number', 'minLevel' => 20], // only Admin can change perm levels
                'hide_stats'           => ['label' => 'Hide Stats', 'type' => 'bool'],
            ],
        ],
        'staff_archived' => [
            'label' => 'Archived Staff', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'staff_id', 'displayMode' => 'table',
            'columns' => [
                'staff_id'              => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'staff_name'            => ['label' => 'Discord Username', 'type' => 'text'],
                'staff_display_name'    => ['label' => 'Display Name', 'type' => 'text'],
                'staff_roblox_name'     => ['label' => 'Roblox Username', 'type' => 'text'],
                'staff_avatar'          => ['label' => 'Avatar', 'type' => 'avatar'],
                'staff_nationality'     => ['label' => 'Nationality', 'type' => 'text'],
                'staff_rank'            => ['label' => 'Rank (at time of leaving)', 'type' => 'text'],
                'staff_days'            => ['label' => 'Days as Staff', 'type' => 'number'],
                'staff_num_sesh_attend' => ['label' => 'Sessions Attended', 'type' => 'number'],
                'hide_stats'            => ['label' => 'Hide Stats', 'type' => 'bool'],
            ],
        ],
        'staff_timeline' => [
            'label' => 'Staff Timeline', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'staff_id', 'displayMode' => 'table',
            'columns' => [
                'staff_id'          => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false, 'resolvedId' => true],
                'days_as_staff'     => ['label' => 'Days as Staff', 'type' => 'number'],
                'assist_auth_start' => ['label' => 'Assist Auth Start', 'type' => 'date'],
                'assist_auth_end'   => ['label' => 'Assist Auth End', 'type' => 'date'],
                'cohost_auth_start' => ['label' => 'Co-Host Auth Start', 'type' => 'date'],
                'cohost_auth_end'   => ['label' => 'Co-Host Auth End', 'type' => 'date'],
                'host_auth_start'   => ['label' => 'Host Auth Start', 'type' => 'date'],
                'host_auth_end'     => ['label' => 'Host Auth End', 'type' => 'date'],
                'manager_start'     => ['label' => 'Manager Start', 'type' => 'date'],
                'manager_end'       => ['label' => 'Manager End', 'type' => 'date'],
            ],
        ],
        'staff_quota' => [
            'label' => 'Staff Quota', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'quota_id', 'displayMode' => 'table',
            'columns' => [
                'quota_id'            => ['label' => 'Quota ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'discord_id'          => ['label' => 'Staff Name', 'type' => 'text', 'resolveId' => true],
                'quota_level'         => ['label' => 'Level', 'type' => 'number'],
                'quota_period'        => ['label' => 'Period (YYYY-MM)', 'type' => 'text'],
                'quota_assist'        => ['label' => 'Assists', 'type' => 'number'],
                'quota_co_host'       => ['label' => 'Co-Hosts', 'type' => 'number'],
                'quota_session_host'  => ['label' => 'Sessions Hosted', 'type' => 'number'],
                'quota_event_host'    => ['label' => 'Events Hosted', 'type' => 'number'],
                'quota_event_co_host' => ['label' => 'Events Co-Hosted', 'type' => 'number'],
                'quota_remark'        => ['label' => 'Remark', 'type' => 'text'],
                'quota_exemption'     => ['label' => 'Exempted', 'type' => 'bool'],
            ],
        ],
        'staff_archived' => [
            'label' => 'Archived Staff', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'staff_id', 'displayMode' => 'table',
            'columns' => [
                'staff_id'              => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'staff_name'            => ['label' => 'Discord Username', 'type' => 'text'],
                'staff_display_name'    => ['label' => 'Display Name', 'type' => 'text'],
                'staff_roblox_name'     => ['label' => 'Roblox Username', 'type' => 'text'],
                'staff_avatar'          => ['label' => 'Avatar', 'type' => 'avatar'],
                'staff_nationality'     => ['label' => 'Nationality', 'type' => 'text'],
                'staff_rank'            => ['label' => 'Rank (at time of leaving)', 'type' => 'text'],
                'staff_days'            => ['label' => 'Days as Staff', 'type' => 'number'],
                'staff_num_sesh_attend' => ['label' => 'Sessions Attended', 'type' => 'number'],
                'hide_stats'            => ['label' => 'Hide Stats', 'type' => 'bool'],
            ],
        ],
        'staff_timeline' => [
            'label' => 'Staff Timeline', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'staff_id', 'displayMode' => 'table',
            'columns' => [
                'staff_id'          => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false, 'resolvedId' => true],
                'days_as_staff'     => ['label' => 'Days as Staff', 'type' => 'number'],
                'staff_nationality' => ['label' => 'Nationality', 'type' => 'text'],
                'assist_auth_start' => ['label' => 'Assist Auth Start', 'type' => 'date'],
                'assist_auth_end'   => ['label' => 'Assist Auth End', 'type' => 'date'],
                'cohost_auth_start' => ['label' => 'Co-Host Auth Start', 'type' => 'date'],
                'cohost_auth_end'   => ['label' => 'Co-Host Auth End', 'type' => 'date'],
                'host_auth_start'   => ['label' => 'Host Auth Start', 'type' => 'date'],
                'host_auth_end'     => ['label' => 'Host Auth End', 'type' => 'date'],
                'manager_start'     => ['label' => 'Manager Start', 'type' => 'date'],
                'manager_end'       => ['label' => 'Manager End', 'type' => 'date'],
            ],
        ],

        'user_list' => [
            'label' => 'User Directory', 'group' => 'Staff Management', 'minLevel' => 15,
            'primaryKey' => 'user_id', 'displayMode' => 'table',
            'columns' => [
                'user_id'              => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'user_name'            => ['label' => 'Discord Username', 'type' => 'text'],
                'user_display_name'    => ['label' => 'Display Name', 'type' => 'text'],
                'user_roblox_name'     => ['label' => 'Roblox Username', 'type' => 'text'],
                'user_avatar'          => ['label' => 'Avatar', 'type' => 'avatar'],
                'user_nationality'     => ['label' => 'Nationality', 'type' => 'text'],
                'user_num_sesh_attend' => ['label' => 'Sessions Attended', 'type' => 'number'],
                'hide_stats'           => ['label' => 'Hide Stats', 'type' => 'bool'],
            ],
        ],

        // ── Admin Only ────────────────────────────────────────────
        'pp_staff_pp' => [
            'label' => 'Staff Logins', 'group' => 'Admin Only', 'minLevel' => 20,
            'primaryKey' => 'user_id', 'displayMode' => 'table',
            'columns' => [
                'user_id'        => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'user_name'      => ['label' => 'Username', 'type' => 'text'],
                'password_hash'  => ['label' => 'Password', 'type' => 'password'],
                'remember_token' => ['label' => 'Remember Token', 'type' => 'text', 'editableOnCreate' => false, 'editableOnUpdate' => false],
            ],
        ],
        'pp_user_pp' => [
            'label' => 'User Logins', 'group' => 'Admin Only', 'minLevel' => 20,
            'primaryKey' => 'user_id', 'displayMode' => 'table',
            'columns' => [
                'user_id'        => ['label' => 'Discord ID', 'type' => 'text', 'editableOnCreate' => true, 'editableOnUpdate' => false],
                'user_name'      => ['label' => 'Username', 'type' => 'text'],
                'password_hash'  => ['label' => 'Password', 'type' => 'password'],
                'remember_token' => ['label' => 'Remember Token', 'type' => 'text', 'editableOnCreate' => false, 'editableOnUpdate' => false],
            ],
        ],
        'user_staff_notif_prefs' => [
            'label' => 'Notification Preferences', 'group' => 'Admin Only', 'minLevel' => 20,
            'primaryKey' => 'user_id', 'displayMode' => 'table', 'readOnly' => true,
            'readOnlyReason' => 'This table has no single-row primary key (user_id + pref_key together make a row unique) — editing here would be ambiguous. Add a synthetic pref_id column to enable full editing.',
            'columns' => [
                'user_id'    => ['label' => 'Discord ID', 'type' => 'text', 'resolvedId' => true],
                'pref_key'   => ['label' => 'Preference', 'type' => 'text'],
                'pref_value' => ['label' => 'Value', 'type' => 'text'],
            ],
        ],
        'notifications' => [
            'label' => 'Announcements', 'group' => 'Admin Only', 'minLevel' => 20,
            'primaryKey' => 'notif_id', 'displayMode' => 'notification_composer',
            'columns' => [
                'notif_id'    => ['label' => 'ID', 'type' => 'number', 'editableOnCreate' => false, 'editableOnUpdate' => false],
                'category'    => ['label' => 'Category', 'type' => 'select', 'pill' => true,
                    'options' => ['Session','Event','Website','System','Manager','Admin','Update']],
                'title'       => ['label' => 'Title', 'type' => 'text'],
                'description' => ['label' => 'Description', 'type' => 'textarea'],
                'posted_at'   => ['label' => 'Posted', 'type' => 'text', 'editableOnCreate' => false, 'editableOnUpdate' => false],
            ],
        ],

        // ── Session Logs ──────────────────────────────────────────
        'session_ongoing' => [
            'label' => 'Live Sessions (Snapshot)', 'group' => 'Session Logs', 'minLevel' => 15,
            'primaryKey' => 'session_id', 'displayMode' => 'cards', 'readOnly' => true,
            'readOnlyReason' => 'This table is actively read/written by the live session sync system every few seconds. Editing it here would race against active sessions — view only. Use the live session page itself to make changes.',
            'columns' => [
                'session_id' => ['label' => 'ID', 'type' => 'number'],
                'session_name' => ['label' => 'Title', 'type' => 'text'],
                'session_status' => ['label' => 'Status', 'type' => 'text', 'pill' => true],
                'host' => ['label' => 'Host', 'type' => 'text'],
                'session_date' => ['label' => 'Date', 'type' => 'date'],
                'session_time' => ['label' => 'Time', 'type' => 'text'],
                'num_slots' => ['label' => 'Trainee Slots', 'type' => 'number'],
            ],
        ],
        'session_post_logs' => [
            'label' => 'Post-Session Summaries', 'group' => 'Session Logs', 'minLevel' => 15,
            'primaryKey' => 'session_id', 'displayMode' => 'table',
            'columns' => [
                'session_id'                => ['label' => 'Session ID', 'type' => 'number', 'editableOnUpdate' => false],
                'session_name'               => ['label' => 'Title', 'type' => 'text'],
                'session_desc'               => ['label' => 'Description', 'type' => 'textarea'],
                'session_status'             => ['label' => 'Final Status', 'type' => 'text', 'pill' => true],
                'session_date'               => ['label' => 'Date', 'type' => 'date'],
                'session_duration_expected'  => ['label' => 'Expected Duration', 'type' => 'text'],
                'session_runtime_actual'     => ['label' => 'Actual Runtime (s)', 'type' => 'number'],
                'num_slots'                  => ['label' => 'Planned Slots', 'type' => 'number'],
                'actual_slots_provided'      => ['label' => 'Actual Slots', 'type' => 'number'],
                'additional_notes'           => ['label' => 'Additional Notes', 'type' => 'textarea'],
                'main_ast_notes'             => ['label' => 'Main AST Notes', 'type' => 'textarea'],
                'started'                    => ['label' => 'Started', 'type' => 'text'],
                'ended'                      => ['label' => 'Ended', 'type' => 'text'],
                'concluded_at'               => ['label' => 'Concluded At', 'type' => 'text', 'editableOnUpdate' => false],
            ],
        ],
        'session_staff_logs' => [
            'label' => 'Session Staff Logs', 'group' => 'Session Logs', 'minLevel' => 15,
            'primaryKey' => 'session_id', 'displayMode' => 'table',
            'columns' => [
                'session_id'          => ['label' => 'Session ID', 'type' => 'number', 'editableOnUpdate' => false],
                'host'                => ['label' => 'Host', 'type' => 'text'],
                'cohost_1'            => ['label' => 'Co-Host 1', 'type' => 'text'],
                'cohost_2'            => ['label' => 'Co-Host 2', 'type' => 'text'],
                'cohost_3'            => ['label' => 'Co-Host 3', 'type' => 'text'],
                'cohost_4/supervisor' => ['label' => 'Supervisor', 'type' => 'text'],
                'assistant_1'         => ['label' => 'Assistant 1', 'type' => 'text'],
                'assistant_2'         => ['label' => 'Assistant 2', 'type' => 'text'],
                'assistant_3'         => ['label' => 'Assistant 3', 'type' => 'text'],
                'assistant_4'         => ['label' => 'Assistant 4', 'type' => 'text'],
                'full_staff_json'     => ['label' => 'Full Roster', 'type' => 'staff_roster_json'], // special formatter, see below
            ],
        ],
        'session_full_logs' => [
            'label' => 'Trainee Session Logs', 'group' => 'Session Logs', 'minLevel' => 15,
            'primaryKey' => 'log_id', 'displayMode' => 'table',
            'columns' => [
                'log_id'              => ['label' => 'Log ID', 'type' => 'number', 'editableOnUpdate' => false],
                'session_id'          => ['label' => 'Session ID', 'type' => 'number'],
                'trainee_id'          => ['label' => 'Trainee Discord ID', 'type' => 'text', 'resolveId' => true],
                'trainee_roblox'      => ['label' => 'Roblox Username', 'type' => 'text'],
                'trainee_zone'        => ['label' => 'Zone', 'type' => 'number'],
                'trainee_attendance'  => ['label' => 'Attended', 'type' => 'bool'],
                'trainer_id'          => ['label' => 'Trainer Discord ID', 'type' => 'text', 'resolveId' => true],
                'trainee_notes'       => ['label' => 'Trainee Notes', 'type' => 'textarea'],
                'staff_notes'         => ['label' => 'Staff Notes', 'type' => 'textarea'],
                'trainee_assessed'    => ['label' => 'Assessed', 'type' => 'bool'],
                'trainee_feedback'    => ['label' => 'Has Feedback', 'type' => 'bool'],
                'feedback_sent'       => ['label' => 'Feedback Sent', 'type' => 'bool'],
            ],
        ],
        'session_feedback_logs' => [
            'label' => 'Feedback Logs', 'group' => 'Session Logs', 'minLevel' => 15,
            'primaryKey' => 'log_id', 'displayMode' => 'table',
            'columns' => [
                'log_id'        => ['label' => 'Log ID', 'type' => 'number', 'editableOnUpdate' => false],
                'session_id'    => ['label' => 'Session ID', 'type' => 'number'],
                'trainee_id'    => ['label' => 'Trainee Discord ID', 'type' => 'text', 'resolveId' => true],
                'trainer_id'    => ['label' => 'Trainer Discord ID', 'type' => 'text', 'resolveId' => true],
                'feedback_json' => ['label' => 'Feedback', 'type' => 'feedback_json'], // special formatter, see below
                'created_at'    => ['label' => 'Created', 'type' => 'text', 'editableOnUpdate' => false],
            ],
        ],
        'session_driver_logs' => [
            'label' => 'Driver Logs', 'group' => 'Session Logs', 'minLevel' => 15,
            'primaryKey' => 'log_id', 'displayMode' => 'table',
            'columns' => [
                'log_id'           => ['label' => 'Log ID', 'type' => 'number', 'editableOnUpdate' => false],
                'session_id'       => ['label' => 'Session ID', 'type' => 'number'],
                'discord_username' => ['label' => 'Discord Username', 'type' => 'text'],
                'roblox_name'      => ['label' => 'Roblox Username', 'type' => 'text'],
                'attendance'       => ['label' => 'Attended', 'type' => 'bool'],
            ],
        ],

        // ── Events (not built yet) ────────────────────────────────
        'event_upcoming' => [
            'label' => 'Upcoming Events', 'group' => 'Events', 'minLevel' => 15,
            'comingSoon' => true,
        ],
        'event_log_archives' => [
            'label' => 'Event Archives', 'group' => 'Events', 'minLevel' => 15,
            'comingSoon' => true,
        ],
    ];
}