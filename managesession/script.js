// ── Profile popup toggle ─────────────────────────────
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = profilePopup.classList.toggle('open');
    chev.classList.toggle('open', open);
});

function showToast(message){
    const container = document.getElementById('toast-container');
    if(!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-msg';
    msgEl.innerHTML = '<i class="fas fa-circle-info"></i> ';
    msgEl.appendChild(document.createTextNode(message));
    const barWrap = document.createElement('div');
    barWrap.className = 'toast-bar';
    barWrap.innerHTML = '<div class="toast-bar-fill"></div>';
    el.appendChild(msgEl);
    el.appendChild(barWrap);
    container.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('show'));
    const t = setTimeout(()=>{ el.classList.add('hide'); setTimeout(()=>el.remove(),250); }, 3000);
    el.addEventListener('click', ()=>{ clearTimeout(t); el.classList.add('hide'); setTimeout(()=>el.remove(),250); });
}
if (typeof TOAST_FLASH !== 'undefined' && TOAST_FLASH) showToast(TOAST_FLASH);

document.addEventListener('click', (e) => {
    if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('open');
        chev.classList.remove('open');
    }
});

const DRAFT_KEY_PREFIX = 'yss_session_draft_';

function currentDraftKey() {
    const id = formSessionId?.value;
    return DRAFT_KEY_PREFIX + (id ? `edit_${id}` : 'new');
}

function saveDraft() {
    const form = document.getElementById('session-form');
    if (!form) return;
    const data = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.name) return;
        data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    localStorage.setItem(currentDraftKey(), JSON.stringify(data));
}

function loadDraft() {
    const raw = localStorage.getItem(currentDraftKey());
    if (!raw) return false;
    try {
        const data = JSON.parse(raw);
        const form = document.getElementById('session-form');
        Object.entries(data).forEach(([name, value]) => {
            const el = form.elements[name];
            if (!el) return;
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        });
        return true;
    } catch { return false; }
}

function clearDraft() {
    localStorage.removeItem(currentDraftKey());
}

document.getElementById('session-form')?.addEventListener('input', saveDraft);

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

function renderTraineeFields(numSlots, data = {}) {
    const container = document.getElementById('modal-trainee-fields');
    let html = '';
    for (let i = 1; i <= numSlots; i++) {
        html += `
            <div class="form-row">
                <div class="form-group">
                    <label>TR. ${i} Discord</label>
                    <input type="text" name="trainee_${i}_discord" id="f-trainee_${i}_discord" placeholder="Discord username" value="${data[`trainee_${i}_discord`] ?? ''}"/>
                </div>
                <div class="form-group">
                    <label>TR. ${i} Discord ID</label>
                    <input type="text" name="trainee_${i}_discord_id" id="f-trainee_${i}_discord_id" placeholder="Discord ID" value="${data[`trainee_${i}_discord_id`] ?? ''}"/>
                </div>
                <div class="form-group">
                    <label>TR. ${i} Roblox</label>
                    <input type="text" name="trainee_${i}_name" id="f-trainee_${i}_name" placeholder="Roblox username" value="${data[`trainee_${i}_name`] ?? ''}"/>
                </div>
                <div class="form-group">
                    <label>TR. ${i} Zone</label>
                    <input type="number" name="trainee_${i}_zone" id="f-trainee_${i}_zone" min="1" max="10" placeholder="Zone ID" value="${data[`trainee_${i}_zone`] ?? ''}"/>
                </div>
                <div class="form-group">
                    <label>TR. ${i} Notes</label>
                    <input type="text" name="trainee_${i}_note" id="f-trainee_${i}_note" placeholder="Optional" value="${data[`trainee_${i}_note`] ?? ''}"/>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function updateBookedToggleState() {
    const statusVal = document.getElementById('f-session_status').value;
    const bookedChk = document.getElementById('f-session_booked');
    bookedChk.disabled = (statusVal === 'Requested');
}
document.getElementById('f-session_status').addEventListener('change', updateBookedToggleState);

// Rebuild trainee rows live whenever the Slots field changes
document.getElementById('f-num_slots').addEventListener('input', (e) => {
    const n = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
    // Preserve whatever's already been typed before wiping the container
    const preserved = {};
    document.querySelectorAll('#modal-trainee-fields input').forEach(inp => { preserved[inp.name] = inp.value; });
    renderTraineeFields(n, preserved);
});

function applyRoleRestrictions() {
    const statusEl = document.getElementById('f-session_status');
    const bookedEl = document.getElementById('f-session_booked');
    statusEl.disabled = IS_HEAD_STAFF;
    if (IS_HEAD_STAFF) bookedEl.disabled = true;
    else updateBookedToggleState(); // re-apply the Requested-based gating for managers
}
document.getElementById('f-session_status').addEventListener('mousedown', (e) => {
    if (IS_HEAD_STAFF) { e.preventDefault(); showToast('Managers only — wait for a manager to update the status.'); }
});
document.querySelector('.toggle-wrap').addEventListener('mousedown', (e) => {
    if (IS_HEAD_STAFF) { e.preventDefault(); showToast('Managers only — wait for a manager to book this session.'); return; }
    if (document.getElementById('f-session_booked').disabled) {
        e.preventDefault();
        showToast('Booked can only be set once the status is no longer "Requested".');
    }
}, true);

function openModal(mode, data = null) {
    formAction.value = mode;

    const customIdGroup = document.getElementById('custom-session-id-group');
    if (mode === 'add') {
        modalTitle.textContent = IS_HEAD_STAFF ? 'Request Session' : 'Add Session';
        submitBtn.innerHTML = IS_HEAD_STAFF
            ? '<i class="fas fa-envelope-open-text"></i> Request Session'
            : 'Add Session';
        formSessionId.value    = '';
        document.getElementById('session-form').reset();
        if (customIdGroup) customIdGroup.style.display = '';
        renderTraineeFields(0, {});
    } else {
        if (customIdGroup) customIdGroup.style.display = 'none';
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
        renderTraineeFields(parseInt(data.num_slots, 10) || 0, data);
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

    updateBookedToggleState();
    applyRoleRestrictions();
    if (loadDraft()) {
    showToast('Restored your unsaved draft from last time.');
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

    // ── Duplicate staff check (host + co_host1-3 + assistant_1-4) ──
    const dupFieldIds = ['f-host','f-co_host1','f-co_host2','f-co_host3','f-assistant_1','f-assistant_2','f-assistant_3','f-assistant_4'];
    const seen = new Set();
    for (const id of dupFieldIds) {
        const val = document.getElementById(id).value.trim();
        if (!val) continue;
        if (seen.has(val)) {
            e.preventDefault();
            showToast(`Duplicate staff entry: "${val}" is assigned to more than one role.`);
            return;
        }
        seen.add(val);
    }

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
    clearDraft();
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