// ── State Management ──────────────────────────────────
let currentSessionId = null;
let currentNumSlots = 10;

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
    
    for (let t = 1; t <= 10; t++) {
        const name = session[`trainee_${t}_name`] || '';
        const zone = session[`trainee_${t}_zone`] || '';
        const note = session[`trainee_${t}_note`] || '';
        if (name) slotsFilled++;
        traineeHtml += `
            <div class="trainee-row-input-grid">
                <span class="trainee-row-num">#${t}</span>
                <input type="text" class="trainee-input trainee-name-field" id="m-trainee-${t}-name" value="${escapeHtml(name)}" placeholder="Trainee Roblox username">
                <input type="number" class="trainee-input trainee-zone-field" id="m-trainee-${t}-zone" value="${zone}" placeholder="Zone" min="1" max="99">
                <input type="text" class="trainee-input trainee-note-field" id="m-trainee-${t}-note" value="${escapeHtml(note)}" placeholder="Note (e.g. Fast learner)">
            </div>
        `;
    }
    traineeListEl.innerHTML = traineeHtml;
    document.getElementById('m-slots').textContent = `${slotsFilled}/${session.num_slots}`;
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
        document.getElementById(`m-trainee-${t}-name`).value = '';
        document.getElementById(`m-trainee-${t}-zone`).value = '';
        document.getElementById(`m-trainee-${t}-note`).value = '';
    }

    lines.forEach((line, index) => {
        const t = index + 1;
        // Strip leading list numbering e.g. "1. " or "- "
        let cleanLine = line.replace(/^\d+[\s\.\-\:]+/, '').replace(/^[\-\*]\s+/, '').trim();

        // Expected format: Name : Zone : Note  (Zone and Note both optional)
        const parts = cleanLine.split(':').map(p => p.trim());
        const name = parts[0] || '';
        const zone = (parts[1] || '').replace(/[^\d]/g, ''); // digits only, so "Zone 8" or "8" both work
        const note = parts.slice(2).join(':').trim();

        document.getElementById(`m-trainee-${t}-name`).value = name;
        document.getElementById(`m-trainee-${t}-zone`).value = zone;
        document.getElementById(`m-trainee-${t}-note`).value = note;
    });
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
            payload[`trainee_${t}_zone`] = null;
            payload[`trainee_${t}_note`] = null;
            continue;
        }
        payload[`trainee_${t}_name`] = nameEl.value.trim();
        const zoneVal = document.getElementById(`m-trainee-${t}-zone`).value;
        payload[`trainee_${t}_zone`] = zoneVal !== '' ? parseInt(zoneVal) : null;
        payload[`trainee_${t}_note`] = document.getElementById(`m-trainee-${t}-note`).value.trim();
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