// ── State Management ──────────────────────────────────
let currentSessionId = null;

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
    // 1. Update active card styling
    const cards = document.querySelectorAll('.sesh-card');
    cards.forEach(card => card.classList.remove('active'));
    element.classList.add('active');

    // 2. Find selected session from SESSIONS_DATA
    const session = SESSIONS_DATA.find(s => parseInt(s.session_id) === parseInt(sessionId));
    if (session) {
        // 3. Render details dynamically inside the right-hand panel
        const detailInner = document.getElementById('detail-inner');
        if (detailInner) {
            detailInner.innerHTML = renderDetailPanelJS(session);
        }
    }
}

// ── Modal Actions ─────────────────────────────────────
function openSetupModal(sessionId) {
    const session = SESSIONS_DATA.find(s => parseInt(s.session_id) === parseInt(sessionId));
    if (!session) return;

    currentSessionId = sessionId;

    // 1. Populate Modal Top Banner
    document.getElementById('m-name').textContent = session.session_name || 'Unnamed Session';
    document.getElementById('m-time').textContent = formatTime(session.session_time);
    document.getElementById('m-dur').textContent = `${session.session_duration} min`;
    
    // Count filled slots and gather trainees
    let slotsFilled = 0;
    const trainees = [];
    for (let t = 1; t <= 10; t++) {
        const name = session[`trainee_${t}_name`] || '';
        if (name) {
            slotsFilled++;
            trainees.push({
                name: name,
                zone: session[`trainee_${t}_zone`] || '',
                note: session[`trainee_${t}_note`] || ''
            });
        }
    }
    document.getElementById('m-slots').textContent = `${slotsFilled}/${session.num_slots}`;

    // 2. Populate Staff Select Dropdowns
    document.getElementById('m-host').value = session.host || '';
    document.getElementById('m-cohost1').value = session.co_host1 || '';
    document.getElementById('m-cohost2').value = session.co_host2 || '';
    document.getElementById('m-cohost3').value = session.co_host3 || '';
    document.getElementById('m-cohost4').value = session.co_host4 || session['co_host4/supervisor'] || '';
    document.getElementById('m-asst1').value = session.assistant_1 || '';
    document.getElementById('m-asst2').value = session.assistant_2 || '';
    document.getElementById('m-asst3').value = session.assistant_3 || '';
    document.getElementById('m-asst4').value = session.assistant_4 || '';

    // 3. Populate Textareas
    document.getElementById('m-desc').value = session.session_desc || '';
    document.getElementById('m-notes').value = session.additional_notes || '';

    // 4. Populate Trainees list inside the Modal
    const traineeListEl = document.getElementById('modal-trainee-list');
    if (trainees.length === 0) {
        traineeListEl.innerHTML = '<div class="no-trainees-msg">No trainees registered for this session.</div>';
    } else {
        traineeListEl.innerHTML = trainees.map((tr, idx) => `
            <div class="modal-trainee-row" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                <span class="mtr-num" style="opacity: 0.5;">#${idx + 1}</span>
                <span class="mtr-name" style="font-weight: 500;">${escapeHtml(tr.name)}</span>
                ${tr.zone ? `<span class="mtr-zone" style="font-size: 0.85em; opacity: 0.8;">Zone ${escapeHtml(tr.zone)}</span>` : ''}
                ${tr.note ? `<span class="mtr-note" title="${escapeHtml(tr.note)}" style="font-size: 0.85em; opacity: 0.6;"><i class="fas fa-note-sticky"></i> ${escapeHtml(tr.note)}</span>` : ''}
            </div>
        `).join('');
    }

    // 5. Open the Modal
    const modalBackdrop = document.getElementById('modal-backdrop');
    modalBackdrop.classList.add('active');
    modalBackdrop.style.display = 'flex'; // Safeguard depending on setup CSS
}

function closeModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    modalBackdrop.classList.remove('active');
    modalBackdrop.style.display = 'none';
    currentSessionId = null;
}

// Close modal when clicking on the background backdrop
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-backdrop')) {
        closeModal();
    }
});

// ── Submit / Save Setup ───────────────────────────────
async function confirmSetup() {
    if (!currentSessionId) return;

    // Collect data
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

    // Optional Validation: Check for duplicates
    const selectedStaff = Object.values(payload).slice(1, 10).filter(name => name !== '');
    if (selectedStaff.length !== new Set(selectedStaff).size) {
        alert('Warning: You have assigned the same staff member to multiple roles!');
        // return; // Uncomment to prevent saving when duplicates exist
    }

    try {
        const response = await fetch('save_session_setup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            // Update client-side data
            const sessionIdx = SESSIONS_DATA.findIndex(s => parseInt(s.session_id) === parseInt(currentSessionId));
            if (sessionIdx !== -1) {
                SESSIONS_DATA[sessionIdx] = { ...SESSIONS_DATA[sessionIdx], ...payload };
                // Refresh right detail panel
                const activeCard = document.querySelector(`.sesh-card[data-id="${currentSessionId}"]`);
                if (activeCard) selectSession(activeCard, currentSessionId);
            }
            closeModal();
            alert('Session details successfully saved!');
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
    let hh = parseInt(hours, 10);
    const m = minutes || '00';
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    hh = hh ? hh : 12; // convert 0 to 12
    return `${hh}:${m} ${ampm}`;
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