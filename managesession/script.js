// ── Profile popup toggle ─────────────────────────────
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = profilePopup.classList.toggle('open');
    chev.classList.toggle('open', open);
});

document.addEventListener('click', (e) => {
    if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});

// ── Auto-submit search on Enter ──────────────────────
document.querySelector('.search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.closest('form').submit();
});

// ── Modal: open / close ──────────────────────────────
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle    = document.getElementById('modal-title');
const formAction    = document.getElementById('form-action');
const formSessionId = document.getElementById('form-session-id');
const submitBtn     = document.getElementById('form-submit-btn');

function openModal(mode, data = null) {
    formAction.value = mode;

    if (mode === 'add') {
        modalTitle.textContent = 'Add Session';
        submitBtn.textContent  = 'Add Session';
        formSessionId.value    = '';
        document.getElementById('session-form').reset();
    } else {
        modalTitle.textContent      = 'Edit Session';
        submitBtn.textContent       = 'Save Changes';
        formSessionId.value         = data.session_id ?? '';

        // Core fields
        document.getElementById('f-session_name').value     = data.session_name     ?? '';
        document.getElementById('f-session_desc').value     = data.session_desc     ?? '';
        document.getElementById('f-session_status').value   = data.session_status   ?? 'Scheduled';
        document.getElementById('f-session_booked').checked = data.session_booked == 1;
        document.getElementById('f-session_date').value     = data.session_date     ?? '';
        document.getElementById('f-session_duration').value = data.session_duration ?? '';
        document.getElementById('f-num_slots').value        = data.num_slots        ?? '';
        document.getElementById('f-trainee_timer').value    = data.trainee_timer    ?? '';

        // Time — strip seconds if present (HH:MM:SS → HH:MM)
        const rawTime = data.session_time ?? '';
        document.getElementById('f-session_time').value = rawTime.length > 5 ? rawTime.slice(0, 5) : rawTime;

        // Staff fields
        document.getElementById('f-host').value                = data.host                   ?? '';
        document.getElementById('f-co_host1').value            = data.co_host1               ?? '';
        document.getElementById('f-co_host2').value            = data.co_host2               ?? '';
        document.getElementById('f-co_host3').value            = data.co_host3               ?? '';
        document.getElementById('f-co_host4_supervisor').value = data['co_host4/supervisor'] ?? '';
        document.getElementById('f-assistant_1').value         = data.assistant_1            ?? '';
        document.getElementById('f-assistant_2').value         = data.assistant_2            ?? '';
        document.getElementById('f-assistant_3').value         = data.assistant_3            ?? '';
        document.getElementById('f-assistant_4').value         = data.assistant_4            ?? '';
        document.getElementById('f-additional_staff').value    = data.additional_staff       ?? '';
    }

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
}

// Close on backdrop click
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
});

// ── Form submit validation ───────────────────────────
document.getElementById('session-form').addEventListener('submit', (e) => {
    const timeVal   = document.getElementById('f-session_time').value.trim();
    const dateVal   = document.getElementById('f-session_date').value.trim();
    const timeError = document.getElementById('time-error');
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    // Validate date
    if (!dateVal) {
        e.preventDefault();
        alert('Please select a session date.');
        document.getElementById('f-session_date').focus();
        return;
    }

    // Validate time
    if (!timeRegex.test(timeVal)) {
        e.preventDefault();
        timeError.textContent  = 'Please enter a valid time in HH:MM format (e.g. 14:30).';
        timeError.style.display = 'inline';
        document.getElementById('f-session_time').focus();
        return;
    }

    timeError.style.display = 'none';
});

// ── Time input formatter ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const timeInput = document.getElementById('f-session_time');
    const timeError = document.getElementById('time-error');

    timeInput.addEventListener('input', () => {
        let value = timeInput.value.replace(/\D/g, '');
        value = value.slice(0, 4);

        let hours   = value.slice(0, 2);
        let minutes = value.slice(2, 4);

        timeError.style.display = 'none';
        timeError.textContent   = '';

        if (hours.length === 2) {
            const hourNum = parseInt(hours);
            if (hourNum === 24) {
                hours = '00';
            } else if (hourNum > 24) {
                timeError.textContent   = 'Invalid hour. Please enter 00–23.';
                timeError.style.display = 'inline';
                hours = '';
            }
        }

        if (minutes.length === 2) {
            const minuteNum = parseInt(minutes);
            if (minuteNum >= 60) {
                timeError.textContent   = 'Invalid minutes. Please enter 00–59.';
                timeError.style.display = 'inline';
                minutes = '';
            }
        }

        timeInput.value = value.length > 2 ? hours + ':' + minutes : hours;
    });
});

// ── Delete confirm modal ─────────────────────────────
const deleteBackdrop  = document.getElementById('delete-backdrop');
const deleteMsg       = document.getElementById('delete-msg');
const deleteSessionId = document.getElementById('delete-session-id');

function confirmDelete(id, name) {
    deleteSessionId.value = id;
    deleteMsg.textContent = `Are you sure you want to delete "${name}"? This cannot be undone.`;
    deleteBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDelete() {
    deleteBackdrop.classList.remove('open');
    document.body.style.overflow = '';
}

deleteBackdrop.addEventListener('click', (e) => {
    if (e.target === deleteBackdrop) closeDelete();
});

// ── Close modals on Escape ───────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modalBackdrop.classList.contains('open'))  closeModal();
    if (deleteBackdrop.classList.contains('open')) closeDelete();
});
document.addEventListener("DOMContentLoaded", () => {
    const timeInput = document.getElementById("f-session_time");
    const timeError = document.getElementById("time-error");

    timeInput.addEventListener("input", () => {
        let value = timeInput.value.replace(/\D/g, ""); // remove non-numbers
        value = value.slice(0, 4); // max HHMM

        let hours = value.slice(0, 2);
        let minutes = value.slice(2, 4);

        // Clear error by default
        timeError.style.display = "none";
        timeError.textContent = "";

        // Validate hours
        if (hours.length === 2) {
            let hourNum = parseInt(hours);

            if (hourNum === 24) {
                hours = "00"; // convert 24 -> 00
            } else if (hourNum > 24) {
                timeError.textContent = "Invalid hour. Please enter 00-23.";
                timeError.style.display = "inline";
                hours = "";
            }
        }

        // Validate minutes
        if (minutes.length === 2) {
            let minuteNum = parseInt(minutes);

            if (minuteNum >= 60) {
                timeError.textContent = "Invalid minutes. Please enter 00-59.";
                timeError.style.display = "inline";
                minutes = "";
            }
        }

        // Rebuild value
        if (value.length > 2) {
            timeInput.value = hours + ":" + minutes;
        } else {
            timeInput.value = hours;
        }
    });
});