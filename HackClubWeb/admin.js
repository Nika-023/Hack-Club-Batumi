// admin/admin.js
// Full CRUD logic for the HackClub Batumi admin panel.

const SUPABASE_URL      = 'https://omcopzvlsydauozhurir.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_KrdBwM6qCkUGTuHVhPmxgg_zWF38WR0'

let sb  // supabase client
let currentAppFilter = 'all'

const DOMAIN_LABELS = { web:'Web Dev', pcb:'Electronics', cad:'CAD', robotics:'Robotics', ml:'ML/AI', game:'Game Dev' }
const DOMAIN_COLORS = { web:'blue', pcb:'amber', cad:'muted', robotics:'green', ml:'blue', game:'amber' }

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Handle existing session on page load directly — do NOT rely on
  // onAuthStateChange being triggered by getSession(), because that race
  // causes the "lock was stolen" error on every refresh.
  const { data: { session: initialSession } } = await sb.auth.getSession()

  if (initialSession) {
    const ok = await checkAdmin(initialSession.user.id)
    if (ok) {
      showAdminPanel()
      loadSection('dashboard')
      updatePendingBadge()
    } else {
      await sb.auth.signOut()
      showLoginScreen('This account does not have admin access.')
    }
  } else {
    showLoginScreen()
  }

  // Listen only for FUTURE auth changes (login / logout clicks)
  // Skip INITIAL_SESSION — already handled above to avoid the double-lock bug
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return

    if (event === 'SIGNED_IN' && session) {
      const ok = await checkAdmin(session.user.id)
      if (ok) {
        showAdminPanel()
        loadSection('dashboard')
        updatePendingBadge()
      } else {
        await sb.auth.signOut()
        showLoginScreen('This account does not have admin access.')
      }
    }

    if (event === 'SIGNED_OUT') {
      showLoginScreen()
    }
  })
})

async function checkAdmin(userId) {
  const { data } = await sb.from('admins').select('id').eq('user_id', userId).maybeSingle()
  return !!data
}

async function updatePendingBadge() {
  const { count } = await sb.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  const badge = document.getElementById('sb-badge-apps')
  if (count > 0) {
    badge.textContent    = count
    badge.style.display  = ''
  } else {
    badge.style.display  = 'none'
  }
}

/* ════════════════════════════════════════
   AUTH
════════════════════════════════════════ */
async function adminLogin() {
  const email    = document.getElementById('admin-email').value.trim()
  const password = document.getElementById('admin-password').value
  const errEl    = document.getElementById('admin-login-error')
  if (!email || !password) { showErr(errEl, 'Fill in both fields.'); return }
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) { showErr(errEl, error.message); return }
  errEl.style.display = 'none'
}
window.adminLogin = adminLogin

async function adminLogout() {
  await sb.auth.signOut()
}
window.adminLogout = adminLogout

/* ════════════════════════════════════════
   NAV
════════════════════════════════════════ */
function showAdminPanel() {
  document.getElementById('login-screen').style.display  = 'none'
  document.getElementById('admin-panel').style.display   = 'flex'
}

function showLoginScreen(msg) {
  document.getElementById('admin-panel').style.display   = 'none'
  document.getElementById('login-screen').style.display  = 'flex'
  if (msg) showErr(document.getElementById('admin-login-error'), msg)
}

function switchSection(name) {
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'))
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'))
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active')
  document.getElementById('sec-' + name)?.classList.add('active')
  loadSection(name)
}
window.switchSection = switchSection

function loadSection(name) {
  const map = {
    dashboard:    loadDashboard,
    applications: loadApplications,
    projects:     loadAdminProjects,
    teams:        loadAdminTeams,
    wins:         loadAdminWins,
    events:       loadAdminEvents,
    ticker:       loadAdminTicker,
    log:          loadAdminLog,
  }
  map[name]?.()
}

/* ════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════ */
async function loadDashboard() {
  const [
    { count: pending  },
    { count: members  },
    { count: projects },
    { count: wins     },
  ] = await Promise.all([
    sb.from('applications').select('*', { count:'exact', head:true }).eq('status','pending'),
    sb.from('members').select('*', { count:'exact', head:true }),
    sb.from('projects').select('*', { count:'exact', head:true }),
    sb.from('wins').select('*', { count:'exact', head:true }),
  ])

  setText('dash-pending',  pending  ?? 0)
  setText('dash-members',  members  ?? 0)
  setText('dash-projects', projects ?? 0)
  setText('dash-wins',     wins     ?? 0)

  const { data: apps } = await sb.from('applications').select('*').order('submitted_at', { ascending:false }).limit(5)
  const el = document.getElementById('dash-recent-apps')
  if (!apps || apps.length === 0) {
    el.innerHTML = '<div class="empty-state">No applications yet.</div>'
    return
  }
  el.innerHTML = apps.map(a => `
    <div class="dash-app-row">
      <span class="badge badge-${DOMAIN_COLORS[a.domain] || 'muted'}">${a.domain}</span>
      <span class="dar-name">${esc(a.name)}</span>
      <span class="dar-email">${esc(a.email)}</span>
      <span class="badge badge-${statusColor(a.status)}">${a.status}</span>
      <button class="btn btn-ghost btn-sm" onclick="switchSection('applications')">View →</button>
    </div>
  `).join('')
}

/* ════════════════════════════════════════
   APPLICATIONS
════════════════════════════════════════ */
let allApps = []

async function loadApplications() {
  const { data } = await sb.from('applications').select('*').order('submitted_at', { ascending:false })
  allApps = data || []
  renderApps(currentAppFilter)
}

function filterApps(status, btn) {
  document.querySelectorAll('.fba-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  currentAppFilter = status
  renderApps(status)
}
window.filterApps = filterApps

function renderApps(filter) {
  const list = filter === 'all' ? allApps : allApps.filter(a => a.status === filter)
  const el   = document.getElementById('apps-container')

  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state">No ${filter === 'all' ? '' : filter + ' '}applications.</div>`
    return
  }

  el.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Domain</th><th>Name</th><th>Email</th><th>Age</th>
          <th>Submitted</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(a => `
          <tr class="expandable" onclick="toggleAppRow('${a.id}')">
            <td><span class="badge badge-${DOMAIN_COLORS[a.domain] || 'muted'}">${a.domain}</span></td>
            <td class="td-name">${esc(a.name)}</td>
            <td class="td-mono">${esc(a.email)}</td>
            <td class="td-muted">${esc(a.age || '—')}</td>
            <td class="td-muted">${fmtDate(a.submitted_at)}</td>
            <td><span class="badge badge-${statusColor(a.status)}">${a.status}</span></td>
            <td onclick="event.stopPropagation()">
              ${a.status === 'pending' ? `
                <button class="btn btn-green btn-sm" onclick="setAppStatus('${a.id}','approved')">Approve</button>
                <button class="btn btn-red btn-sm"   onclick="setAppStatus('${a.id}','rejected')">Reject</button>
              ` : `
                <button class="btn btn-ghost btn-sm" onclick="setAppStatus('${a.id}','pending')">Reset</button>
              `}
            </td>
          </tr>
          <tr id="app-detail-${a.id}" style="display:none">
            <td colspan="7">
              <div class="app-detail">
                <div><strong>Portfolio</strong> ${a.portfolio_url ? `<a href="${esc(a.portfolio_url)}" target="_blank" style="color:var(--blue)">${esc(a.portfolio_url)}</a>` : '—'}</div>
                <div style="margin-top:.6rem"><strong>Submission</strong> ${a.submission_url ? `<a href="${esc(a.submission_url)}" target="_blank" style="color:var(--blue)">${esc(a.submission_url)}</a>` : '—'}</div>
                <div style="margin-top:.6rem"><strong>Note</strong> ${esc(a.submission_note || '—')}</div>
                ${a.reviewer_note ? `<div style="margin-top:.6rem;color:var(--amber)"><strong>Reviewer note</strong> ${esc(a.reviewer_note)}</div>` : ''}
                <div class="app-note-form" style="margin-top:1rem">
                  <textarea class="note-input" id="note-${a.id}" placeholder="Add reviewer note…">${esc(a.reviewer_note || '')}</textarea>
                  <button class="btn btn-ghost btn-sm" onclick="saveReviewerNote('${a.id}')">Save Note</button>
                </div>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function toggleAppRow(id) {
  const row = document.getElementById('app-detail-' + id)
  if (!row) return
  row.style.display = row.style.display === 'none' ? '' : 'none'
}
window.toggleAppRow = toggleAppRow

async function setAppStatus(id, status) {
  await sb.from('applications').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
  const app = allApps.find(a => a.id === id)
  if (app) app.status = status
  renderApps(currentAppFilter)
  updatePendingBadge()
}
window.setAppStatus = setAppStatus

async function saveReviewerNote(id) {
  const note = document.getElementById('note-' + id)?.value.trim()
  await sb.from('applications').update({ reviewer_note: note }).eq('id', id)
  const app = allApps.find(a => a.id === id)
  if (app) app.reviewer_note = note
  // no full re-render needed — just visual feedback
  const btn = document.querySelector(`#app-detail-${id} .btn-ghost`)
  if (btn) { btn.textContent = 'Saved ✓'; setTimeout(() => { btn.textContent = 'Save Note' }, 1500) }
}
window.saveReviewerNote = saveReviewerNote

/* ════════════════════════════════════════
   PROJECTS
════════════════════════════════════════ */
async function loadAdminProjects() {
  const { data } = await sb.from('projects').select('*').order('sort_order')
  const el = document.getElementById('admin-projects-grid')
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No projects yet.</div>'; return }

  el.innerHTML = data.map(p => `
    <div class="admin-card proj-card-admin" data-status="${p.status}">
      <div class="ac-domain">${p.domain} · <span style="color:${p.status==='building'?'var(--green)':'var(--muted)'}">${p.status}</span></div>
      <div class="ac-title">${esc(p.title)}</div>
      <div class="ac-desc">${esc(p.description || '')}</div>
      <div class="ac-footer">
        <span class="badge badge-${p.badge_type || 'green'}">${esc(p.badge_text || '')}</span>
        <div class="ac-actions">
          <button class="btn btn-ghost btn-sm" onclick="openProjectModal(${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-red btn-sm"   onclick="deleteRecord('projects','${p.id}',loadAdminProjects)">Del</button>
        </div>
      </div>
    </div>
  `).join('')
}

function filterAdminCards(val, btn, cls) {
  document.querySelectorAll('.fba-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  document.querySelectorAll('.' + cls).forEach(c => {
    c.style.display = (val === 'all' || c.dataset.status === val) ? '' : 'none'
  })
}
window.filterAdminCards = filterAdminCards

function openProjectModal(p) {
  p = p || {}
  openModal(p.id ? 'Edit Project' : 'Add Project', `
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Domain</label>
        <select class="form-input" id="m-domain">
          ${['web','pcb','cad','robotics','ml','game'].map(d => `<option value="${d}" ${p.domain===d?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label class="form-label">Status</label>
        <select class="form-input" id="m-status">
          <option value="building" ${p.status==='building'?'selected':''}>Building</option>
          <option value="shipped"  ${p.status==='shipped' ?'selected':''}>Shipped</option>
        </select>
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Title</label>
      <input class="form-input" id="m-title" type="text" value="${esc(p.title||'')}" placeholder="Project name">
    </div>
    <div class="form-field">
      <label class="form-label">Description</label>
      <textarea class="form-input note-input" id="m-desc" rows="2" placeholder="Short description">${esc(p.description||'')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Badge Text</label>
        <input class="form-input" id="m-badge-text" type="text" value="${esc(p.badge_text||'')}" placeholder="e.g. YSWS ✓">
      </div>
      <div class="form-field">
        <label class="form-label">Badge Color</label>
        <select class="form-input" id="m-badge-type">
          ${['green','amber','blue','muted'].map(c => `<option value="${c}" ${p.badge_type===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Contributors <span style="color:var(--muted);font-size:.6rem">(comma-separated initials: AK, MT)</span></label>
      <input class="form-input" id="m-contributors" type="text" value="${(p.contributors||[]).join(', ')}" placeholder="AK, MT">
    </div>
    <div class="form-field">
      <label class="form-label">Sort Order</label>
      <input class="form-input" id="m-sort" type="number" value="${p.sort_order||0}">
    </div>
  `, async () => {
    const payload = {
      domain:       document.getElementById('m-domain').value,
      status:       document.getElementById('m-status').value,
      title:        document.getElementById('m-title').value.trim(),
      description:  document.getElementById('m-desc').value.trim(),
      badge_text:   document.getElementById('m-badge-text').value.trim(),
      badge_type:   document.getElementById('m-badge-type').value,
      contributors: document.getElementById('m-contributors').value.split(',').map(s=>s.trim()).filter(Boolean),
      sort_order:   parseInt(document.getElementById('m-sort').value) || 0,
    }
    if (!payload.title) throw new Error('Title is required.')
    const { error } = p.id
      ? await sb.from('projects').update(payload).eq('id', p.id)
      : await sb.from('projects').insert(payload)
    if (error) throw new Error(error.message)
    closeModal()
    loadAdminProjects()
  })
}
window.openProjectModal = openProjectModal

/* ════════════════════════════════════════
   TEAMS
════════════════════════════════════════ */
async function loadAdminTeams() {
  const { data } = await sb.from('teams').select('*').order('sort_order')
  const el = document.getElementById('admin-teams-list')
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">No teams found.</div>'; return }

  el.innerHTML = data.map(t => `
    <div class="team-admin-card">
      <div class="tac-header">
        <div>
          <div class="tac-name">${esc(t.icon||'')} ${esc(t.name)}</div>
          <div class="tac-domain">${t.domain} · ${t.tagline || ''}</div>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="badge badge-${t.status==='open'?'green':t.status==='waitlist'?'amber':'muted'}">${t.status}</span>
          <button class="btn btn-ghost btn-sm" onclick="openTeamModal(${JSON.stringify(t).replace(/"/g,'&quot;')})">Edit</button>
        </div>
      </div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.6">
        <span style="color:var(--text)">Leader:</span> ${esc(t.leader_name||'—')} &nbsp;·&nbsp;
        <span style="color:var(--text)">Open spots:</span> ${t.open_spots} &nbsp;·&nbsp;
        <span style="color:var(--text)">Projects:</span> ${t.stat_projects}
      </div>
      <div style="font-size:.82rem;color:var(--muted);margin-top:.4rem">
        <span style="color:var(--text)">Focus:</span> ${esc(t.focus_text||'—')}
      </div>
    </div>
  `).join('')
}

function openTeamModal(t) {
  const members = Array.isArray(t.members) ? t.members : JSON.parse(t.members || '[]')
  const membersStr = members.map(m => `${m.initials}:${m.name}`).join(', ')

  openModal('Edit Team — ' + t.name, `
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Status</label>
        <select class="form-input" id="m-status">
          <option value="open"     ${t.status==='open'    ?'selected':''}>Open</option>
          <option value="waitlist" ${t.status==='waitlist'?'selected':''}>Waitlist</option>
          <option value="closed"   ${t.status==='closed'  ?'selected':''}>Closed</option>
        </select>
      </div>
      <div class="form-field">
        <label class="form-label">Icon</label>
        <input class="form-input" id="m-icon" type="text" value="${esc(t.icon||'')}" placeholder="⟨/⟩">
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Leader Name</label>
        <input class="form-input" id="m-leader-name" type="text" value="${esc(t.leader_name||'')}">
      </div>
      <div class="form-field">
        <label class="form-label">Leader Initials</label>
        <input class="form-input" id="m-leader-init" type="text" value="${esc(t.leader_initials||'')}" maxlength="2">
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Tagline</label>
      <input class="form-input" id="m-tagline" type="text" value="${esc(t.tagline||'')}">
    </div>
    <div class="form-field">
      <label class="form-label">Members <span style="color:var(--muted);font-size:.6rem">(format: INITIALS:Full Name, ...)</span></label>
      <input class="form-input" id="m-members" type="text" value="${esc(membersStr)}" placeholder="MT:M.Tsiklauri, DL:D.Loria">
    </div>
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Open Spots</label>
        <input class="form-input" id="m-open-spots" type="number" value="${t.open_spots||0}" min="0">
      </div>
      <div class="form-field">
        <label class="form-label">Stat: Projects</label>
        <input class="form-input" id="m-stat-projects" type="number" value="${t.stat_projects||0}" min="0">
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Stat 2 Label</label>
      <input class="form-input" id="m-stat2" type="text" value="${esc(t.stat2_label||'')}" placeholder="2 YSWS wins">
    </div>
    <div class="form-field">
      <label class="form-label">Current Focus</label>
      <textarea class="form-input note-input" id="m-focus" rows="2">${esc(t.focus_text||'')}</textarea>
    </div>
  `, async () => {
    const rawMembers = document.getElementById('m-members').value.split(',').map(s => s.trim()).filter(Boolean)
    const membersJson = rawMembers.map(s => {
      const [init, ...rest] = s.split(':')
      return { initials: init.trim(), name: rest.join(':').trim() || init.trim() }
    })
    const payload = {
      status:          document.getElementById('m-status').value,
      icon:            document.getElementById('m-icon').value.trim(),
      leader_name:     document.getElementById('m-leader-name').value.trim(),
      leader_initials: document.getElementById('m-leader-init').value.trim().toUpperCase(),
      tagline:         document.getElementById('m-tagline').value.trim(),
      members:         membersJson,
      open_spots:      parseInt(document.getElementById('m-open-spots').value) || 0,
      stat_projects:   parseInt(document.getElementById('m-stat-projects').value) || 0,
      stat2_label:     document.getElementById('m-stat2').value.trim(),
      focus_text:      document.getElementById('m-focus').value.trim(),
    }
    const { error } = await sb.from('teams').update(payload).eq('id', t.id)
    if (error) throw new Error(error.message)
    closeModal()
    loadAdminTeams()
  })
}
window.openTeamModal = openTeamModal

/* ════════════════════════════════════════
   WINS
════════════════════════════════════════ */
async function loadAdminWins() {
  const { data } = await sb.from('wins').select('*').order('sort_order')
  const el = document.getElementById('admin-wins-grid')
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No wins yet.</div>'; return }

  el.innerHTML = data.map(w => `
    <div class="admin-card">
      <div class="ac-domain">
        <span class="badge badge-${w.place_type==='gold'?'amber':w.place_type==='silver'?'muted':'green'}">${esc(w.place)}</span>
        <span style="margin-left:.4rem;font-size:.72rem">${esc(w.event_name)}</span>
      </div>
      <div class="ac-title" style="margin-top:.5rem">${esc(w.title)}</div>
      <div class="ac-desc">${esc(w.description||'')}</div>
      <div class="ac-footer">
        <span style="font-size:.75rem;color:var(--muted)">${esc(w.prize_text||'')}</span>
        <div class="ac-actions">
          <button class="btn btn-ghost btn-sm" onclick="openWinModal(${JSON.stringify(w).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-red btn-sm"   onclick="deleteRecord('wins','${w.id}',loadAdminWins)">Del</button>
        </div>
      </div>
    </div>
  `).join('')
}

function openWinModal(w) {
  w = w || {}
  openModal(w.id ? 'Edit Win' : 'Add Win', `
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Place Label</label>
        <input class="form-input" id="m-place" type="text" value="${esc(w.place||'')}" placeholder="1ST, 2ND, YSWS ✓">
      </div>
      <div class="form-field">
        <label class="form-label">Place Type</label>
        <select class="form-input" id="m-place-type">
          <option value="gold"   ${w.place_type==='gold'  ?'selected':''}>Gold (1st)</option>
          <option value="silver" ${w.place_type==='silver'?'selected':''}>Silver (2nd)</option>
          <option value="accept" ${w.place_type==='accept'?'selected':''}>Accept (YSWS)</option>
        </select>
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Event Name</label>
      <input class="form-input" id="m-event-name" type="text" value="${esc(w.event_name||'')}" placeholder="HardHack 2026 — Electronics">
    </div>
    <div class="form-field">
      <label class="form-label">Project Title</label>
      <input class="form-input" id="m-title" type="text" value="${esc(w.title||'')}">
    </div>
    <div class="form-field">
      <label class="form-label">Description</label>
      <textarea class="form-input note-input" id="m-desc" rows="2">${esc(w.description||'')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Team</label>
        <input class="form-input" id="m-team" type="text" value="${esc(w.team_text||'')}" placeholder="Web Group · Alex K. +1">
      </div>
      <div class="form-field">
        <label class="form-label">Prize</label>
        <input class="form-input" id="m-prize" type="text" value="${esc(w.prize_text||'')}" placeholder="$500 + Hardware">
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Sort Order</label>
      <input class="form-input" id="m-sort" type="number" value="${w.sort_order||0}">
    </div>
  `, async () => {
    const payload = {
      place:        document.getElementById('m-place').value.trim(),
      place_type:   document.getElementById('m-place-type').value,
      event_name:   document.getElementById('m-event-name').value.trim(),
      title:        document.getElementById('m-title').value.trim(),
      description:  document.getElementById('m-desc').value.trim(),
      team_text:    document.getElementById('m-team').value.trim(),
      prize_text:   document.getElementById('m-prize').value.trim(),
      sort_order:   parseInt(document.getElementById('m-sort').value) || 0,
    }
    if (!payload.title || !payload.event_name) throw new Error('Title and event name are required.')
    const { error } = w.id
      ? await sb.from('wins').update(payload).eq('id', w.id)
      : await sb.from('wins').insert(payload)
    if (error) throw new Error(error.message)
    closeModal()
    loadAdminWins()
  })
}
window.openWinModal = openWinModal

/* ════════════════════════════════════════
   EVENTS
════════════════════════════════════════ */
async function loadAdminEvents() {
  const { data } = await sb.from('events').select('*').order('sort_order')
  const el = document.getElementById('admin-events-list')
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">No events yet.</div>'; return }

  el.innerHTML = data.map(e => `
    <div class="event-admin-row">
      <span class="ear-date">${esc(e.date_label)}</span>
      <span>${esc(e.title)}</span>
      <span class="badge badge-${e.badge_type}">${esc(e.badge_text)}</span>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-ghost btn-sm" onclick="openEventModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-red btn-sm"   onclick="deleteRecord('events','${e.id}',loadAdminEvents)">Del</button>
      </div>
    </div>
  `).join('')
}

function openEventModal(e) {
  e = e || {}
  openModal(e.id ? 'Edit Event' : 'Add Event', `
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Date Label</label>
        <input class="form-input" id="m-date-label" type="text" value="${esc(e.date_label||'')}" placeholder="apr 12">
      </div>
      <div class="form-field">
        <label class="form-label">Date (optional)</label>
        <input class="form-input" id="m-event-date" type="date" value="${e.event_date||''}">
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Title</label>
      <input class="form-input" id="m-title" type="text" value="${esc(e.title||'')}" placeholder="YSWS Summer submissions open">
    </div>
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Badge Text</label>
        <input class="form-input" id="m-badge-text" type="text" value="${esc(e.badge_text||'plan')}" placeholder="soon / open / plan">
      </div>
      <div class="form-field">
        <label class="form-label">Badge Color</label>
        <select class="form-input" id="m-badge-type">
          <option value="green" ${e.badge_type==='green'?'selected':''}>Green</option>
          <option value="amber" ${e.badge_type==='amber'?'selected':''}>Amber</option>
          <option value="muted" ${e.badge_type==='muted'?'selected':''}>Muted</option>
        </select>
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Sort Order</label>
      <input class="form-input" id="m-sort" type="number" value="${e.sort_order||0}">
    </div>
  `, async () => {
    const payload = {
      date_label:  document.getElementById('m-date-label').value.trim(),
      title:       document.getElementById('m-title').value.trim(),
      badge_text:  document.getElementById('m-badge-text').value.trim(),
      badge_type:  document.getElementById('m-badge-type').value,
      event_date:  document.getElementById('m-event-date').value || null,
      sort_order:  parseInt(document.getElementById('m-sort').value) || 0,
    }
    if (!payload.title || !payload.date_label) throw new Error('Title and date label are required.')
    const { error } = e.id
      ? await sb.from('events').update(payload).eq('id', e.id)
      : await sb.from('events').insert(payload)
    if (error) throw new Error(error.message)
    closeModal()
    loadAdminEvents()
  })
}
window.openEventModal = openEventModal

/* ════════════════════════════════════════
   TICKER
════════════════════════════════════════ */
async function loadAdminTicker() {
  const { data } = await sb.from('ticker_items').select('*').order('sort_order')
  const el = document.getElementById('admin-ticker-list')
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">No ticker items.</div>'; return }

  el.innerHTML = data.map(t => `
    <div class="ticker-item-row ${t.active ? '' : 'inactive'}" id="tir-${t.id}">
      <span class="tir-order">${t.sort_order}</span>
      <label class="toggle" title="Active">
        <input type="checkbox" ${t.active ? 'checked' : ''} onchange="toggleTicker('${t.id}', this.checked)">
        <div class="toggle-track"></div>
      </label>
      <span class="tir-text" title="${esc(t.text)}">${esc(t.text)}</span>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-ghost btn-sm" onclick="openTickerModal(${JSON.stringify(t).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-red btn-sm"   onclick="deleteRecord('ticker_items','${t.id}',loadAdminTicker)">Del</button>
      </div>
    </div>
  `).join('')
}

async function toggleTicker(id, active) {
  await sb.from('ticker_items').update({ active }).eq('id', id)
  const row = document.getElementById('tir-' + id)
  if (row) row.classList.toggle('inactive', !active)
}
window.toggleTicker = toggleTicker

function openTickerModal(t) {
  t = t || {}
  openModal(t.id ? 'Edit Ticker Item' : 'Add Ticker Item', `
    <div class="form-field">
      <label class="form-label">Text</label>
      <input class="form-input" id="m-text" type="text" value="${esc(t.text||'')}" placeholder="PCB Group — 1st place HardHack 2026">
    </div>
    <div class="form-field">
      <label class="form-label">Sort Order</label>
      <input class="form-input" id="m-sort" type="number" value="${t.sort_order||0}">
    </div>
    <div class="form-field" style="display:flex;align-items:center;gap:.8rem">
      <label class="toggle">
        <input type="checkbox" id="m-active" ${t.active !== false ? 'checked' : ''}>
        <div class="toggle-track"></div>
      </label>
      <span class="form-label" style="margin:0">Active</span>
    </div>
  `, async () => {
    const payload = {
      text:       document.getElementById('m-text').value.trim(),
      sort_order: parseInt(document.getElementById('m-sort').value) || 0,
      active:     document.getElementById('m-active').checked,
    }
    if (!payload.text) throw new Error('Text is required.')
    const { error } = t.id
      ? await sb.from('ticker_items').update(payload).eq('id', t.id)
      : await sb.from('ticker_items').insert(payload)
    if (error) throw new Error(error.message)
    closeModal()
    loadAdminTicker()
  })
}
window.openTickerModal = openTickerModal

/* ════════════════════════════════════════
   ACTIVITY LOG
════════════════════════════════════════ */
async function loadAdminLog() {
  const { data } = await sb.from('activity_log').select('*').order('created_at', { ascending:false })
  const el = document.getElementById('admin-log-list')
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty-state">No log entries.</div>'; return }

  el.innerHTML = data.map(e => `
    <div class="log-admin-row">
      <span class="lar-hash">${esc(e.hash)}</span>
      <span class="lar-branch">${esc(e.branch)}</span>
      <span style="font-size:.82rem">${esc(e.message)}</span>
      <span style="font-family:var(--mono);font-size:.7rem;color:var(--muted)">${esc(e.time_label)}</span>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-ghost btn-sm" onclick="openLogModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-red btn-sm"   onclick="deleteRecord('activity_log','${e.id}',loadAdminLog)">Del</button>
      </div>
    </div>
  `).join('')
}

function openLogModal(e) {
  e = e || {}
  openModal(e.id ? 'Edit Log Entry' : 'Add Log Entry', `
    <div class="form-row">
      <div class="form-field">
        <label class="form-label">Hash <span style="color:var(--muted);font-size:.6rem">(6 chars)</span></label>
        <input class="form-input" id="m-hash" type="text" value="${esc(e.hash||'')}" maxlength="7" placeholder="a3f92c">
      </div>
      <div class="form-field">
        <label class="form-label">Branch</label>
        <input class="form-input" id="m-branch" type="text" value="${esc(e.branch||'')}" placeholder="web, pcb, robot…">
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">Message</label>
      <input class="form-input" id="m-message" type="text" value="${esc(e.message||'')}" placeholder="Shipped AI Tutor — YSWS accepted">
    </div>
    <div class="form-field">
      <label class="form-label">Time Label</label>
      <input class="form-input" id="m-time" type="text" value="${esc(e.time_label||'')}" placeholder="2h ago, 1d ago">
    </div>
  `, async () => {
    const payload = {
      hash:       document.getElementById('m-hash').value.trim(),
      branch:     document.getElementById('m-branch').value.trim(),
      message:    document.getElementById('m-message').value.trim(),
      time_label: document.getElementById('m-time').value.trim(),
    }
    if (!payload.message || !payload.hash) throw new Error('Hash and message are required.')
    const { error } = e.id
      ? await sb.from('activity_log').update(payload).eq('id', e.id)
      : await sb.from('activity_log').insert(payload)
    if (error) throw new Error(error.message)
    closeModal()
    loadAdminLog()
  })
}
window.openLogModal = openLogModal

/* ════════════════════════════════════════
   MODAL ENGINE
════════════════════════════════════════ */
let _modalSaveFn = null

function openModal(title, bodyHtml, saveFn) {
  _modalSaveFn = saveFn
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML    = bodyHtml
  document.getElementById('modal-footer').innerHTML  = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-red"   onclick="modalSave()" id="modal-save-btn">Save →</button>
  `
  document.getElementById('modal-overlay').classList.add('open')
  // Focus first input
  setTimeout(() => document.querySelector('#modal-box input, #modal-box select, #modal-box textarea')?.focus(), 50)
}

async function modalSave() {
  const btn = document.getElementById('modal-save-btn')
  if (!btn || !_modalSaveFn) return
  btn.disabled    = true
  btn.textContent = 'Saving…'
  try {
    await _modalSaveFn()
    // If _modalSaveFn didn't throw, it succeeded — button stays disabled (modal closing)
  } catch(e) {
    alert('Save failed: ' + (e.message || String(e)))
    btn.disabled    = false
    btn.textContent = 'Save →'
  }
}
window.modalSave = modalSave

function closeModal(e) {
  // If clicking the overlay itself (not the box), close
  if (e && e.target !== document.getElementById('modal-overlay')) return
  document.getElementById('modal-overlay').classList.remove('open')
  _modalSaveFn = null
}
window.closeModal = closeModal

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal()
})

/* ════════════════════════════════════════
   SHARED DELETE
════════════════════════════════════════ */
async function deleteRecord(table, id, reloadFn) {
  if (!confirm('Delete this item? This cannot be undone.')) return
  const { error } = await sb.from(table).delete().eq('id', id)
  if (error) { alert('Delete failed: ' + error.message); return }
  reloadFn()
}
window.deleteRecord = deleteRecord

/* ════════════════════════════════════════
   UTILS
════════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id)
  if (el) el.textContent = val
}

function esc(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
}

function showErr(el, msg) {
  el.textContent   = msg
  el.style.display = 'block'
}

function statusColor(s) {
  return s === 'pending' ? 'amber' : s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'muted'
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
}