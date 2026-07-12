// setupsesh.js
// ── State Management ──────────────────────────────────
let currentSessionId = null;
let currentNumSlots = 10;

// Trainer Assignment Automation
let trainerAssignmentMode = 'auto'; // 'auto' | 'manual'

function getTrainerCandidates() {
    const ids = ['m-host', 'm-cohost1', 'm-cohost2', 'm-cohost3', 'm-cohost4'];
    return ids.map(id => document.getElementById(id).value.trim()).filter(v => v);
}

// Splits traineeCount as evenly as possible across trainers, priority order (host first)
// gets the leftover "extra" slots when it doesn't divide evenly.
function computeAutoDistribution(trainers, traineeCount) {
    if (!trainers.length || traineeCount <= 0) return [];
    const base = Math.floor(traineeCount / trainers.length);
    const remainder = traineeCount % trainers.length;
    const counts = trainers.map((_, i) => base + (i < remainder ? 1 : 0));
    const assignment = [];
    trainers.forEach((name, i) => {
        for (let c = 0; c < counts[i]; c++) assignment.push(name);
    });
    return assignment; // assignment[0] -> trainee #1's trainer, etc.
}

function applyTrainerAssignment() {
    const trainers = getTrainerCandidates();
    const assignment = computeAutoDistribution(trainers, currentNumSlots);
    for (let t = 1; t <= currentNumSlots; t++) {
        const sel = document.getElementById(`m-trainee-${t}-trainer`);
        if (!sel) continue;
        if (trainerAssignmentMode === 'auto') {
            sel.value = assignment[t - 1] || '';
            sel.disabled = true;
        } else {
            sel.disabled = false;
        }
    }
}

function setTrainerMode(mode) {
    trainerAssignmentMode = mode;
    document.getElementById('mode-auto-btn').classList.toggle('active', mode === 'auto');
    document.getElementById('mode-manual-btn').classList.toggle('active', mode === 'manual');
    applyTrainerAssignment();
}

// Recompute automatically whenever staff assignment changes, if in auto mode
['m-host','m-cohost1','m-cohost2','m-cohost3','m-cohost4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
        if (trainerAssignmentMode === 'auto') applyTrainerAssignment();
    });
});

// ── Toasts ────────────────────────────────────────────
const toastContainer = document.getElementById('toast-container');
function showToast(message) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-msg';
    msgEl.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ';
    msgEl.appendChild(document.createTextNode(message));
    const barWrap = document.createElement('div');
    barWrap.className = 'toast-bar';
    const barFill = document.createElement('div');
    barFill.className = 'toast-bar-fill';
    barWrap.appendChild(barFill);
    el.appendChild(msgEl);
    el.appendChild(barWrap);
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const TOAST_MS = 5000;
    const removeTimer = setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 250);
    }, TOAST_MS);
    // click to dismiss early
    el.addEventListener('click', () => {
        clearTimeout(removeTimer);
        el.classList.add('hide');
        setTimeout(() => el.remove(), 250);
    });
}

const STAFF_SELECT_IDS = ['m-host','m-cohost1','m-cohost2','m-cohost3','m-cohost4','m-asst1','m-asst2','m-asst3','m-asst4'];
const STAFF_ROLE_LABELS = {
    'm-host': 'Host',
    'm-cohost1': 'Co-Host 1',
    'm-cohost2': 'Co-Host 2',
    'm-cohost3': 'Co-Host 3',
    'm-cohost4': 'Co-Host 4 / Supervisor',
    'm-asst1': 'Assistant 1',
    'm-asst2': 'Assistant 2',
    'm-asst3': 'Assistant 3',
    'm-asst4': 'Assistant 4',
};

// Warn live when a staff member gets assigned to a role that already has them
STAFF_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
        const val = el.value.trim();
        if (!val) return;
        const key = val.toLowerCase();
        const match = STAFF_SELECT_IDS
            .map(oid => document.getElementById(oid))
            .find(other => other && other !== el && other.value.trim().toLowerCase() === key);
        if (match) {
            showToast(`${val} is already assigned as ${STAFF_ROLE_LABELS[match.id]} — can't also be ${STAFF_ROLE_LABELS[id]}. Selection reverted.`);
            el.value = '';
        }
    });
});
// Warn live when a trainee field (Discord, Discord ID, Roblox) duplicates another trainee row
document.getElementById('modal-trainee-list').addEventListener('input', (e) => {
    const el = e.target;
    let groupClass = null, fieldLabel = null;
    if (el.classList.contains('trainee-discord-field')) { groupClass = '.trainee-discord-field'; fieldLabel = 'Discord username'; }
    else if (el.classList.contains('trainee-discordid-field')) { groupClass = '.trainee-discordid-field'; fieldLabel = 'Discord ID'; }
    else if (el.classList.contains('trainee-name-field')) { groupClass = '.trainee-name-field'; fieldLabel = 'Roblox username'; }
    else return;

    const val = el.value.trim();
    if (!val) return;
    const key = val.toLowerCase();
    const match = Array.from(document.querySelectorAll(groupClass))
        .find(other => other !== el && other.value.trim().toLowerCase() === key);
    if (match) {
        const slotMatch = match.id.match(/m-trainee-(\d+)-/);
        const slotNum = slotMatch ? slotMatch[1] : '?';
        showToast(`This ${fieldLabel} is already used by Trainee #${slotNum}. Entry cleared.`);
        el.value = '';
        if (el.classList.contains('trainee-name-field')) updateSlotsFilledCount();
    }
});

function updateSlotsFilledCount() {
    const nameFields = document.querySelectorAll('#modal-trainee-list .trainee-name-field');
    let filled = 0;
    nameFields.forEach(f => { if (f.value.trim()) filled++; });
    const slotsEl = document.getElementById('m-slots');
    if (slotsEl) slotsEl.textContent = `${filled}/${currentNumSlots}`;
}

document.getElementById('modal-trainee-list').addEventListener('input', (e) => {
    if (e.target.classList.contains('trainee-name-field')) updateSlotsFilledCount();
});

// -- Duplicate Detection Utility --
function findDuplicates(values) {
    const counts = {};
    values.forEach(v => {
        const key = (v || '').trim().toLowerCase();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).filter(k => counts[k] > 1);
}

// ── Profile Popup Toggle ──────────────────────────────
const profileBtn   = document.getElementById('profile-btn');
const profilePopup = document.getElementById('profile-popup');
const chev         = document.getElementById('chev');

if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profilePopup.classList.toggle('open');
        if (chev) chev.classList.toggle('open', isOpen);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('open');
            if (chev) chev.classList.remove('open');
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            profilePopup.classList.remove('open');
            if (chev) chev.classList.remove('open');
            closeModal();
        }
    });
}

// ── Session Selection ─────────────────────────────────
function selectSession(element, sessionId) {
    const cards = document.querySelectorAll('.sesh-card');
    cards.forEach(card => card.classList.remove('active'));
    element.classList.add('active');
    // Fetch pre-rendered HTML via AJAX
    const detailInner = document.getElementById('detail-inner');
    if (detailInner) {
        detailInner.innerHTML = `
            <div class="detail-empty">
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>Loading session details...</p>
            </div>
        `;
        fetch(`setupsesh_detail_partial.php?session_id=${sessionId}`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load session');
                return response.text();
            })
            .then(html => {
                detailInner.innerHTML = html;
            })
            .catch(err => {
                console.error(err);
                detailInner.innerHTML = `<div class="detail-empty"><p>Error loading details.</p></div>`;
            });
    }
}

// ── Modal Actions ─────────────────────────────────────
function openSetupModal(sessionId) {
    const session = SESSIONS_DATA.find(s => parseInt(s.session_id) === parseInt(sessionId));
    if (!session) return;
    currentSessionId = sessionId;
    // Reset auto-fill box
    document.getElementById('m-paste-box').value = '';
    // 1. Populate Info Banner
    document.getElementById('m-name').textContent = session.session_name || 'Unnamed Session';
    document.getElementById('m-time').textContent = formatTime(session.session_time);
    document.getElementById('m-dur').textContent = `${session.session_duration} min`;
    
    // 2. Populate Staff dropdowns
    document.getElementById('m-host').value = session.host || '';
    document.getElementById('m-cohost1').value = session.co_host1 || '';
    document.getElementById('m-cohost2').value = session.co_host2 || '';
    document.getElementById('m-cohost3').value = session.co_host3 || '';
    document.getElementById('m-cohost4').value = session.co_host4 || session['co_host4/supervisor'] || '';
    document.getElementById('m-asst1').value = session.assistant_1 || '';
    document.getElementById('m-asst2').value = session.assistant_2 || '';
    document.getElementById('m-asst3').value = session.assistant_3 || '';
    document.getElementById('m-asst4').value = session.assistant_4 || '';
    // 3. Render 10 Trainee Input rows
    currentNumSlots = parseInt(session.num_slots, 10) || 10;
    const traineeListEl = document.getElementById('modal-trainee-list');
    let traineeHtml = '';
    let slotsFilled = 0;
    
        for (let t = 1; t <= currentNumSlots; t++) {
        const name = session[`trainee_${t}_name`] || '';
        const discord = session[`trainee_${t}_discord`] || '';
        const discordId = session[`trainee_${t}_discord_id`] || '';
        const zone = session[`trainee_${t}_zone`] || '';
        const note = session[`trainee_${t}_note`] || '';
        if (name) slotsFilled++;
        const trainerName = session[`trainee_${t}_trainer_name`] || '';
        traineeHtml += `
            <div class="trainee-row-input-grid with-trainer">
                <span class="trainee-row-num">#${t}</span>
                <input type="text" class="trainee-input trainee-discord-field" id="m-trainee-${t}-discord" value="${escapeHtml(discord)}" placeholder="Trainee Discord username">
                <input type="text" class="trainee-input trainee-discordid-field" id="m-trainee-${t}-discordid" value="${escapeHtml(discordId)}" placeholder="Discord ID">
                <input type="text" class="trainee-input trainee-name-field" id="m-trainee-${t}-name" value="${escapeHtml(name)}" placeholder="Trainee Roblox username">
                <input type="number" class="trainee-input trainee-zone-field" id="m-trainee-${t}-zone" value="${zone}" placeholder="Zone" min="1" max="10">
                <select class="trainee-input trainee-trainer-field" id="m-trainee-${t}-trainer" style="width:200px;" disabled></select>
                <input type="text" class="trainee-input trainee-note-field" id="m-trainee-${t}-note" value="${escapeHtml(note)}" placeholder="Note (e.g. Fast learner)">
            </div>
        `;
    }
    traineeListEl.innerHTML = traineeHtml;
    const trainerOptionSource = getTrainerCandidates();
    for (let t = 1; t <= currentNumSlots; t++) {
        const sel = document.getElementById(`m-trainee-${t}-trainer`);
        if (!sel) continue;
        sel.innerHTML = '<option value="">— None —</option>' +
            trainerOptionSource.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    }
    trainerAssignmentMode = session.trainer_assignment_mode === 'manual' ? 'manual' : 'auto';
    document.getElementById('mode-auto-btn').classList.toggle('active', trainerAssignmentMode === 'auto');
    document.getElementById('mode-manual-btn').classList.toggle('active', trainerAssignmentMode === 'manual');
    if (trainerAssignmentMode === 'auto') {
        applyTrainerAssignment();
    } else {
        for (let t = 1; t <= currentNumSlots; t++) {
            const sel = document.getElementById(`m-trainee-${t}-trainer`);
            if (sel) { sel.value = session[`trainee_${t}_trainer_name`] || ''; sel.disabled = false; }
        }
    }
    updateSlotsFilledCount();
    // 4. Description & Notes
    document.getElementById('m-desc').value = session.session_desc || '';
    document.getElementById('m-notes').value = session.additional_notes || '';
    // 5. Open Modal
    const modalBackdrop = document.getElementById('modal-backdrop');
    modalBackdrop.classList.add('active');
    modalBackdrop.style.display = 'flex';
}

function closeModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (!modalBackdrop.classList.contains('active')) return;
    modalBackdrop.classList.remove('active');
    modalBackdrop.classList.add('closing');
    setTimeout(() => {
        modalBackdrop.classList.remove('closing');
        modalBackdrop.style.display = 'none';
    }, 250);
    currentSessionId = null;
}

// Close modal when clicking on the background backdrop
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-backdrop')) {
        closeModal();
    }
});


// ── Auto-Fill Core Logic ──────────────────────────────
function autofillTrainees() {
    const text = document.getElementById('m-paste-box').value;
    if (!text.trim()) {
        alert('Please paste some text into the paste box first!');
        return;
    }
    const maxSlots = currentNumSlots || 10;
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, maxSlots);

    // Reset inputs for this session's slots first
    for (let t = 1; t <= maxSlots; t++) {
        document.getElementById(`m-trainee-${t}-discord`).value = '';
        document.getElementById(`m-trainee-${t}-discordid`).value = '';
        document.getElementById(`m-trainee-${t}-name`).value = '';
        document.getElementById(`m-trainee-${t}-zone`).value = '';
        document.getElementById(`m-trainee-${t}-note`).value = '';
    }

        lines.forEach((line, index) => {
        const t = index + 1;
        // Strip leading list numbering e.g. "1. " or "- "
        let cleanLine = line.replace(/^\d+[\s\.\-\:]+/, '').replace(/^[\-\*]\s+/, '').trim();

        // Expected format: Discord : DiscordID : Roblox : Zone : Note  (all but Discord are optional)
        const parts = cleanLine.split(':').map(p => p.trim());
        const discord   = parts[0] || '';
        const discordId = (parts[1] || '').replace(/[^\d]/g, '');
        const roblox    = parts[2] || '';
        const zone      = (parts[3] || '').replace(/[^\d]/g, '');
        const note      = parts.slice(4).join(':').trim();

        document.getElementById(`m-trainee-${t}-discord`).value = discord;
        document.getElementById(`m-trainee-${t}-discordid`).value = discordId;
        document.getElementById(`m-trainee-${t}-name`).value = roblox;
        document.getElementById(`m-trainee-${t}-zone`).value = zone;
        document.getElementById(`m-trainee-${t}-note`).value = note;
    });
    updateSlotsFilledCount();
    alert(`Parsed and autofilled ${lines.length} trainees!`);
}
function autofillStaff() {
    const text = document.getElementById('m-paste-box').value;
    if (!text.trim()) {
        alert('Please paste some text into the paste box first!');
        return;
    }
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    const roleMap = {
        'host': 'm-host',
        'cohost1': 'm-cohost1',
        'cohost2': 'm-cohost2',
        'cohost3': 'm-cohost3',
        'cohost4': 'm-cohost4',
        'supervisor': 'm-cohost4',
        'asst1': 'm-asst1',
        'asst2': 'm-asst2',
        'asst3': 'm-asst3',
        'asst4': 'm-asst4',
    };
    let matchedAny = false;
    const hasRoleLabels = lines.some(line => /^(host|co\-?host|asst|assistant|supervisor)/i.test(line));
    if (hasRoleLabels) {
        // Parse "Role: Username" lines
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const label = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
                const rawName = parts.slice(1).join(':').trim();
                
                let key = label.replace('assistant', 'asst').replace('co-host', 'cohost');
                if (key === 'cohost') key = 'cohost1';
                if (key === 'asst') key = 'asst1';
                const selectId = roleMap[key];
                if (selectId) {
                    const selectEl = document.getElementById(selectId);
                    if (selectEl) {
                        setSelectByMatchingText(selectEl, rawName);
                        matchedAny = true;
                    }
                }
            }
        });
    }
    // Fallback: If no labels match, assign lines sequentially
    if (!matchedAny) {
        const order = ['m-host', 'm-cohost1', 'm-cohost2', 'm-cohost3', 'm-cohost4', 'm-asst1', 'm-asst2', 'm-asst3', 'm-asst4'];
        lines.forEach((line, index) => {
            if (index < order.length) {
                const selectEl = document.getElementById(order[index]);
                if (selectEl) setSelectByMatchingText(selectEl, line);
            }
        });
    }
    alert('Staff dropdowns autofilled!');
}

function setSelectByMatchingText(selectEl, text) {
    const searchVal = text.toLowerCase().trim();
    if (!searchVal) return;
    for (let i = 0; i < selectEl.options.length; i++) {
        const optText = selectEl.options[i].text.toLowerCase();
        const optVal = selectEl.options[i].value.toLowerCase();
        if (optText.includes(searchVal) || optVal.includes(searchVal)) {
            selectEl.selectedIndex = i;
            return;
        }
    }
    selectEl.value = ''; // Reset if not found
}

// ── Submit / Save Setup ───────────────────────────────
async function confirmSetup() {
    if (!currentSessionId) return;
    const payload = {
        session_id: currentSessionId,
        host: document.getElementById('m-host').value,
        co_host1: document.getElementById('m-cohost1').value,
        co_host2: document.getElementById('m-cohost2').value,
        co_host3: document.getElementById('m-cohost3').value,
        co_host4: document.getElementById('m-cohost4').value,
        assistant_1: document.getElementById('m-asst1').value,
        assistant_2: document.getElementById('m-asst2').value,
        assistant_3: document.getElementById('m-asst3').value,
        assistant_4: document.getElementById('m-asst4').value,
        session_desc: document.getElementById('m-desc').value,
        additional_notes: document.getElementById('m-notes').value
    };
    // Grab Trainee Input Values dynamically — only rendered up to num_slots; the rest get cleared
    for (let t = 1; t <= 10; t++) {
        const nameEl = document.getElementById(`m-trainee-${t}-name`);
        if (!nameEl) {
            payload[`trainee_${t}_name`] = null;
            payload[`trainee_${t}_discord`] = null;
            payload[`trainee_${t}_discord_id`] = null;
            payload[`trainee_${t}_zone`] = null;
            payload[`trainee_${t}_note`] = null;
            continue;
        }
        payload[`trainee_${t}_name`] = nameEl.value.trim();
        payload[`trainee_${t}_discord`] = document.getElementById(`m-trainee-${t}-discord`).value.trim();
        payload[`trainee_${t}_discord_id`] = document.getElementById(`m-trainee-${t}-discordid`).value.trim();
        const zoneVal = document.getElementById(`m-trainee-${t}-zone`).value;
        payload[`trainee_${t}_zone`] = zoneVal !== '' ? parseInt(zoneVal) : null;
        payload[`trainee_${t}_note`] = document.getElementById(`m-trainee-${t}-note`).value.trim();
        const trainerSel = document.getElementById(`m-trainee-${t}-trainer`);
        payload[`trainee_${t}_trainer_name`] = trainerSel ? trainerSel.value.trim() : '';
    }
    payload.trainer_assignment_mode = trainerAssignmentMode;

    // ── Duplicate checks ──
    const staffDupes = findDuplicates([
        payload.host, payload.co_host1, payload.co_host2, payload.co_host3, payload.co_host4,
        payload.assistant_1, payload.assistant_2, payload.assistant_3, payload.assistant_4
    ]);
    if (staffDupes.length > 0) {
        showToast(`Cannot save — the same staff member is assigned to more than one role: ${staffDupes.join(', ')}.`);
        return;
    }

    const traineeNames = [], traineeDiscords = [], traineeDiscordIds = [];
    for (let t = 1; t <= 10; t++) {
        if (payload[`trainee_${t}_name`]) traineeNames.push(payload[`trainee_${t}_name`]);
        if (payload[`trainee_${t}_discord`]) traineeDiscords.push(payload[`trainee_${t}_discord`]);
        if (payload[`trainee_${t}_discord_id`]) traineeDiscordIds.push(payload[`trainee_${t}_discord_id`]);
    }
    const nameDupes = findDuplicates(traineeNames);
    const discordDupes = findDuplicates(traineeDiscords);
    const discordIdDupes = findDuplicates(traineeDiscordIds);
    if (nameDupes.length || discordDupes.length || discordIdDupes.length) {
        const parts = [];
        if (nameDupes.length) parts.push(`Roblox username: ${nameDupes.join(', ')}`);
        if (discordDupes.length) parts.push(`Discord username: ${discordDupes.join(', ')}`);
        if (discordIdDupes.length) parts.push(`Discord ID: ${discordIdDupes.join(', ')}`);
        showToast(`Cannot start — duplicate trainee entries found (${parts.join('; ')}).`);
        return;
    }

    try {
        const response = await fetch('save_session_setup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            // Update client data cache
            const sessionIdx = SESSIONS_DATA.findIndex(s => parseInt(s.session_id) === parseInt(currentSessionId));
            if (sessionIdx !== -1) {
                SESSIONS_DATA[sessionIdx] = { ...SESSIONS_DATA[sessionIdx], ...payload };
                // Refresh left list card and right details view
                const activeCard = document.querySelector(`.sesh-card[data-id="${currentSessionId}"]`);
                if (activeCard) selectSession(activeCard, currentSessionId);
            }
            window.location.href = `../sessionongoing/sessionongoing.php?session_id=${currentSessionId}`;
            return; // navigating away — no need to close the modal manually
        } else {
            alert('Failed to save setup: ' + (result.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error saving session setup:', err);
        alert('An error occurred. Check connection and try again.');
    }
}

// ── Helper functions ──────────────────────────────────
function formatTime(timeStr) {
    if (!timeStr) return '—';
    const [hours, minutes] = timeStr.split(':');
    const hh = hours.padStart(2, '0');
    const mm = (minutes || '00').padStart(2, '0');
    return `${hh}:${mm}`;
}


function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Client-side implementation of PHP's renderDetailPanel ──
function renderDetailPanelJS(s) {
    const timeFormatted = formatTime(s.session_time);
    
    let slotsFilled = 0;
    const trainees = [];
    for (let t = 1; t <= 10; t++) {
        const name = s[`trainee_${t}_name`] || '';
        if (name) {
            slotsFilled++;
            trainees.push({
                name: name,
                zone: s[`trainee_${t}_zone`] || '',
                note: s[`trainee_${t}_note`] || ''
            });
        }
    }

    const staffFields = [
        { key: 'host', icon: 'fa-crown', label: 'Host' },
        { key: 'co_host1', icon: 'fa-user-tie', label: 'Co-Host' },
        { key: 'co_host2', icon: 'fa-user-tie', label: 'Co-Host' },
        { key: 'co_host3', icon: 'fa-user-tie', label: 'Co-Host' },
        { key: 'co_host4', icon: 'fa-user-gear', label: 'Supervisor' },
        { key: 'assistant_1', icon: 'fa-user', label: 'Asst' },
        { key: 'assistant_2', icon: 'fa-user', label: 'Asst' },
        { key: 'assistant_3', icon: 'fa-user', label: 'Asst' },
        { key: 'assistant_4', icon: 'fa-user', label: 'Asst' }
    ];

    let staffChipsHtml = '';
    let hasStaff = false;
    staffFields.forEach(field => {
        // Safe key check in case of db column name variants
        const val = s[field.key] || s[field.key === 'co_host4' ? 'co_host4/supervisor' : ''] || '';
        if (val) {
            hasStaff = true;
            staffChipsHtml += `
                <span class="staff-chip">
                    <i class="fas ${field.icon}"></i>
                    ${escapeHtml(val)}
                    <span class="staff-chip-role">${field.label}</span>
                </span>
            `;
        }
    });

    if (!hasStaff) {
        staffChipsHtml = '<span class="no-staff-msg">No staff assigned yet</span>';
    }

    let traineesHtml = '';
    if (trainees.length > 0) {
        traineesHtml = `
            <div class="detail-section">
                <div class="detail-section-label">Trainees (${trainees.length})</div>
                <div class="trainee-chips">
                    ${trainees.map(tr => `
                        <div class="trainee-chip">
                            <div class="trainee-chip-avatar"><i class="fas fa-graduation-cap"></i></div>
                            <div class="trainee-chip-info">
                                <div class="trainee-chip-name">${escapeHtml(tr.name)}</div>
                                ${tr.zone ? `<div class="trainee-chip-zone">Zone ${escapeHtml(tr.zone)}</div>` : ''}
                            </div>
                            ${tr.note ? `
                                <div class="trainee-chip-note" title="${escapeHtml(tr.note)}">
                                    <i class="fas fa-note-sticky"></i>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const descHtml = s.session_desc 
        ? `<div class="detail-desc">${escapeHtml(s.session_desc).replace(/\n/g, '<br>')}</div>` 
        : '';

    return `
        <div class="detail-header">
            <div class="detail-status detail-status--${s.session_status.toLowerCase()}">
                ${escapeHtml(s.session_status)}
            </div>
            <h2 class="detail-name">${escapeHtml(s.session_name || 'Unnamed Session')}</h2>
            <div class="detail-time-row">
                <span><i class="fas fa-clock"></i> ${escapeHtml(timeFormatted)}</span>
                <span><i class="fas fa-hourglass-half"></i> ${escapeHtml(s.session_duration)} min</span>
                <span><i class="fas fa-id-badge"></i> #${parseInt(s.session_id)}</span>
            </div>
        </div>

        <div class="detail-stats">
            <div class="dstat">
                <div class="dstat-val">${slotsFilled}/${parseInt(s.num_slots)}</div>
                <div class="dstat-label">Trainees</div>
            </div>
            <div class="dstat">
                <div class="dstat-val">${escapeHtml(s.session_duration)}m</div>
                <div class="dstat-label">Duration</div>
            </div>
            <div class="dstat">
                <div class="dstat-val">${escapeHtml(s.session_time)}</div>
                <div class="dstat-label">Start Time</div>
            </div>
        </div>

        ${descHtml}

        <div class="detail-section">
            <div class="detail-section-label">Host & Staff</div>
            <div class="detail-staff-chips">
                ${staffChipsHtml}
            </div>
        </div>

        ${traineesHtml}

        <div class="detail-actions">
            <button class="btn-setup" onclick="openSetupModal(${parseInt(s.session_id)})">
                <i class="fas fa-play"></i> Setup Session
            </button>
        </div>
    `;
}