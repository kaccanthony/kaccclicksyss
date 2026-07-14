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
    document.addEventListener('click', (e) => {
        if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('open');
            if (chev) chev.classList.remove('open');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            profilePopup.classList.remove('open');
            if (chev) chev.classList.remove('open');
        }
    });
}

async function refreshPublicTable(){
  if (!SESSION_ID) return;
  try {
    const res = await fetch(`public_session_state.php?session_id=${SESSION_ID}`);
    const data = await res.json();
    const tbody = document.getElementById('public-rows');
    if (!tbody) return;
    tbody.innerHTML = data.rows.map(r => `
      <tr>
        <td>${r.slot}</td>
        <td>${r.discord}</td>
        <td>${r.roblox}</td>
        <td>${r.zone ?? '—'}</td>
        <td>${r.trainer || '—'}</td>
        <td class="chk-cell">${r.done ? '<i class="fas fa-check-circle done"></i>' : '<i class="fas fa-circle"></i>'}</td>
      </tr>`).join('');
  } catch(e) { /* silent — just retry next poll */ }
}
setInterval(refreshPublicTable, 5000);

