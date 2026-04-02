// js/app.js
// Core app logic: page routing, apply wizard, project filtering, Supabase data loading.

/* ════════════════════════════════════════
   SUPABASE CLIENT ACCESSOR
   window._sb is initialized by auth.js which loads first.
   We wrap it in a getter so calls during DOMContentLoaded are safe.
════════════════════════════════════════ */
function sb() { return window._sb }

/* ════════════════════════════════════════
   PAGE ROUTING
════════════════════════════════════════ */
const PAGES = ['home', 'projects', 'teams', 'wins', 'apply', 'login', 'account']

function showPage(id) {
  PAGES.forEach(p => {
    document.getElementById('page-' + p)?.classList.remove('active')
    document.getElementById('nav-' + p)?.classList.remove('active')
  })
  document.getElementById('page-' + id)?.classList.add('active')
  document.getElementById('nav-' + id)?.classList.add('active')
  window.scrollTo({ top: 0, behavior: 'instant' })

  // Lazy-load page data when navigating
  if (id === 'projects') loadProjects()
  if (id === 'teams')    loadTeams()
  if (id === 'wins')     loadWins()
  if (id === 'apply')    loadApplyDomains()
}
window.showPage = showPage

function toggleMobileNav() {
  document.getElementById('nav-links').classList.toggle('open')
}
function closeMobileNav() {
  document.getElementById('nav-links').classList.remove('open')
}
window.toggleMobileNav = toggleMobileNav
window.closeMobileNav  = closeMobileNav

/* ════════════════════════════════════════
   PROJECTS FILTER
════════════════════════════════════════ */
function filterProjects(domain, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  document.querySelectorAll('.proj-card').forEach(card => {
    card.style.display = (domain === 'all' || card.dataset.domain === domain) ? '' : 'none'
  })
  document.querySelectorAll('.building-card').forEach(card => {
    card.style.display = (domain === 'all' || card.dataset.domain === domain) ? '' : 'none'
  })
}
window.filterProjects = filterProjects

/* ════════════════════════════════════════
   TICKER
════════════════════════════════════════ */
async function loadTicker() {
  if (!sb()) return
  const { data } = await sb()
    .from('ticker_items')
    .select('text')
    .eq('active', true)
    .order('sort_order')

  if (!data || data.length === 0) return
  const el = document.getElementById('ticker-inner')
  if (!el) return

  // Duplicate items for seamless CSS loop
  const items = [...data, ...data]
  el.innerHTML = items.map(i => `<span class="ticker-item">${i.text}</span>`).join('')
}

/* ════════════════════════════════════════
   HOME: RECENT PROJECTS PREVIEW
════════════════════════════════════════ */
const DOMAIN_ICONS = { web:'⟨/⟩', pcb:'⚡', cad:'◈', robotics:'⊕', ml:'◉', game:'▷' }
const DOMAIN_LABELS = { web:'Web Development', pcb:'Electronics & PCB', cad:'CAD & Mechanical', robotics:'Robotics', ml:'ML / AI', game:'Game Dev' }

async function loadHomeProjects() {
  if (!sb()) return
  const el = document.getElementById('home-projects-grid')
  if (!el) return

  // Fetch 3 most recently created projects, any status
  const { data } = await sb()
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)

  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-family:var(--mono);font-size:.8rem">No projects yet.</p>'; return }

  el.innerHTML = data.map(p => `
    <div class="preview-card" onclick="showPage('projects')">
      <div class="pc-domain">${DOMAIN_ICONS[p.domain] || '◎'} ${DOMAIN_LABELS[p.domain] || p.domain}</div>
      <div class="pc-title">${p.title}</div>
      <div class="pc-desc">${p.description || ''}</div>
      <div class="pc-footer">
        <span class="badge badge-${p.badge_type || 'green'}">${p.badge_type === 'green' ? '<span class="pulse"></span>' : ''}${p.badge_text || (p.status === 'building' ? 'Building' : 'Shipped')}</span>
        <span class="meta-time">${timeAgo(p.created_at)}</span>
      </div>
    </div>
  `).join('')
}

/* ════════════════════════════════════════
   HOME: ACTIVITY LOG
════════════════════════════════════════ */
async function loadHomeLog() {
  if (!sb()) return
  const el = document.getElementById('home-log')
  if (!el) return

  const { data } = await sb()
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-family:var(--mono);font-size:.78rem">No activity yet.</p>'; return }

  el.innerHTML = data.map(e => `
    <div class="log-row">
      <div class="log-hash">${e.hash}</div>
      <div class="log-msg"><span class="br">${e.branch}</span>${e.message}</div>
      <div class="log-time">${e.time_label}</div>
    </div>
  `).join('')
}

/* ════════════════════════════════════════
   HOME: UPCOMING EVENTS
════════════════════════════════════════ */
async function loadHomeEvents() {
  if (!sb()) return
  const el = document.getElementById('home-events')
  if (!el) return

  const { data } = await sb()
    .from('events')
    .select('*')
    .order('sort_order')

  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-family:var(--mono);font-size:.78rem">No upcoming events.</p>'; return }

  el.innerHTML = data.map(e => `
    <div class="log-row">
      <div class="log-hash amber">${e.date_label}</div>
      <div class="log-msg">${e.title}</div>
      <div class="log-time"><span class="badge badge-${e.badge_type}" style="font-size:.58rem">${e.badge_text}</span></div>
    </div>
  `).join('')
}

/* ════════════════════════════════════════
   ACCOUNT: UPCOMING TASKS (from events table)
════════════════════════════════════════ */
async function loadAccountTasks() {
  if (!sb()) return
  const el = document.getElementById('acct-task-list')
  if (!el) return

  const { data } = await sb()
    .from('events')
    .select('*')
    .order('sort_order')
    .limit(5)

  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--muted)">No upcoming tasks.</p>'; return }

  const dotColor = { green:'green', amber:'amber', muted:'muted' }
  el.innerHTML = data.map(e => `
    <div class="task-item">
      <div class="task-dot ${dotColor[e.badge_type] || 'muted'}"></div>
      <div class="task-text">${e.title} — ${e.date_label}</div>
      <span class="badge badge-${e.badge_type}">${e.badge_text}</span>
    </div>
  `).join('')
}

/* ════════════════════════════════════════
   PROJECTS PAGE
════════════════════════════════════════ */
async function loadProjects() {
  if (!sb()) return

  const { data } = await sb()
    .from('projects')
    .select('*')
    .order('sort_order')

  if (!data) return

  const building = data.filter(p => p.status === 'building')
  const shipped  = data.filter(p => p.status === 'shipped')

  const buildingEl = document.getElementById('building-cards')
  const shippedEl  = document.getElementById('projects-grid')
  const totalEl    = document.getElementById('projects-total')

  if (totalEl) totalEl.textContent = shipped.length

  if (buildingEl) {
    buildingEl.innerHTML = building.length === 0
      ? '<p style="color:var(--muted);font-family:var(--mono);font-size:.8rem">Nothing in progress right now.</p>'
      : building.map(p => `
        <div class="building-card" data-domain="${p.domain}">
          <div class="bc-bar ${p.badge_type === 'amber' ? 'amber' : ''}"></div>
          <div class="bc-content">
            <div class="bc-domain">${DOMAIN_LABELS[p.domain] || p.domain}</div>
            <div class="bc-title">${p.title}</div>
            <div class="bc-desc">${p.description || ''}</div>
            <div class="bc-meta">
              <span class="badge badge-${p.badge_type || 'green'}">
                ${p.badge_type === 'green' ? '<span class="pulse"></span>' : ''}${p.badge_text || 'Active'}
              </span>
              <span class="bc-member">${(p.contributors || []).join(' · ')}</span>
            </div>
          </div>
        </div>
      `).join('')
  }

  if (shippedEl) {
    shippedEl.innerHTML = shipped.length === 0
      ? '<p style="color:var(--muted);font-family:var(--mono);font-size:.8rem">No shipped projects yet.</p>'
      : shipped.map(p => `
        <div class="proj-card" data-domain="${p.domain}">
          <div class="proj-domain-bar ${p.domain}"></div>
          <div class="proj-domain">${DOMAIN_LABELS[p.domain] || p.domain}</div>
          <div class="proj-title">${p.title}</div>
          <div class="proj-desc">${p.description || ''}</div>
          <div class="proj-footer">
            <div class="proj-contributors">
              ${(p.contributors || []).map(c => `<div class="contributor">${c}</div>`).join('')}
            </div>
            <span class="badge badge-${p.badge_type || 'green'}">${p.badge_text || 'Shipped'}</span>
          </div>
        </div>
      `).join('')
  }
}

/* ════════════════════════════════════════
   TEAMS PAGE
════════════════════════════════════════ */
async function loadTeams() {
  if (!sb()) return
  const el = document.getElementById('teams-grid')
  if (!el) return

  const { data } = await sb()
    .from('teams')
    .select('*')
    .order('sort_order')

  if (!data) return

  el.innerHTML = data.map(t => {
    const members = Array.isArray(t.members) ? t.members : (t.members ? JSON.parse(t.members) : [])
    const statusBadge = t.status === 'open'
      ? `<span class="badge badge-green"><span class="pulse"></span>Open</span>`
      : t.status === 'waitlist'
      ? `<span class="badge badge-amber">Waitlist</span>`
      : `<span class="badge badge-muted">Closed</span>`

    const applyBtn = t.status === 'open'
      ? `<button class="btn btn-ghost btn-sm" onclick="showPage('apply')">Apply →</button>`
      : `<button class="btn btn-ghost btn-sm" style="opacity:.4;cursor:not-allowed">${t.status === 'waitlist' ? 'Waitlist' : 'Closed'}</button>`

    const memberChips = members.map(m => `<span class="member-chip">${m.name}</span>`).join('')
    const openChip    = t.open_spots > 0 ? `<span class="member-chip">+${t.open_spots} open</span>` : ''

    return `
      <div class="team-card ${t.domain}">
        <div class="team-top-bar"></div>
        <div class="team-header">
          <div>
            <div class="team-icon">${t.icon || '◎'}</div>
            <div class="team-name">${t.name}</div>
            <div class="team-tagline">${t.tagline || ''}</div>
          </div>
          ${statusBadge}
        </div>
        <hr class="team-divider">
        <div class="team-leader">
          <div class="leader-avatar">${t.leader_initials || '??'}</div>
          <div>
            <div class="leader-name">${t.leader_name || '—'}</div>
            <div class="leader-role">Group Leader</div>
          </div>
        </div>
        <div class="team-members">${memberChips}${openChip}</div>
        <div class="team-focus">
          <div class="focus-label">Current Focus</div>
          <div class="focus-text">${t.focus_text || '—'}</div>
        </div>
        <div class="team-footer">
          <div class="team-stats-row">
            <div class="ts"><span>${t.stat_projects}</span> projects</div>
            <div class="ts">${t.stat2_label || ''}</div>
          </div>
          ${applyBtn}
        </div>
      </div>
    `
  }).join('')
}

/* ════════════════════════════════════════
   WINS PAGE
════════════════════════════════════════ */
async function loadWins() {
  if (!sb()) return

  const { data } = await sb()
    .from('wins')
    .select('*')
    .order('sort_order')

  if (!data) return

  const el = document.getElementById('trophy-grid')
  if (el) {
    el.innerHTML = data.map(w => `
      <div class="trophy-card">
        <div class="trophy-place ${w.place_type}">${w.place}</div>
        <div class="trophy-event">${w.event_name}</div>
        <div class="trophy-title">${w.title}</div>
        <div class="trophy-desc">${w.description || ''}</div>
        <div class="trophy-meta">
          <span class="trophy-team">${w.team_text || ''}</span>
          <span class="trophy-prize">${w.prize_text || ''}</span>
        </div>
      </div>
    `).join('')
  }

  // Update counters
  const firstCount = data.filter(w => w.place_type === 'gold').length
  const yswsCount  = data.filter(w => w.place_type === 'accept').length
  const totalCount = data.length

  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val }
  setEl('wins-first-count', firstCount + '×')
  setEl('wins-total-count', totalCount + '+')
  setEl('wins-ysws-count',  yswsCount  + '×')
  setEl('wins-rate',        firstCount + '/' + totalCount)
}

/* ════════════════════════════════════════
   APPLY WIZARD
════════════════════════════════════════ */
const EXAM_PROMPTS = {
  web: {
    name: 'Web Development',
    prompt: 'Build and deploy a real-time collaborative code snippet editor. Users must be able to create a room, share a link, and edit code together live. Any stack, any hosting. Focus: ship it working.',
    accepts: ['Deployed URL', 'GitHub repository', 'Short writeup (what was hard)']
  },
  pcb: {
    name: 'Electronics & PCB',
    prompt: 'Design a 2-layer PCB for a 555-timer based PWM motor speed controller. Must handle 0–100% duty cycle at up to 5A. Submit schematic + Gerber files + BOM.',
    accepts: ['Gerber files (.zip)', 'Schematic PDF', 'BOM']
  },
  cad: {
    name: 'CAD & Mechanical',
    prompt: 'Design a parametric servo motor mount bracket. Must be 3D printable, fit a standard MG996R servo, and include M3 bolt holes for wall-mounting. Provide STEP + STL with tolerancing notes.',
    accepts: ['STEP file', 'STL file', 'PDF drawing with tolerances']
  },
  robotics: {
    name: 'Robotics',
    prompt: 'Implement and tune a PID controller for a 2-wheel differential drive robot. Show your code, describe your tuning process with before/after behavior, and submit a video of it running or a simulation.',
    accepts: ['GitHub repository', 'Video link (YouTube / Drive)', 'PDF tuning writeup']
  },
  ml: {
    name: 'ML / AI (Waitlist)',
    prompt: 'This domain is currently on waitlist. Submit your email to be notified when a spot opens.',
    accepts: ['Email only']
  },
  game: {
    name: 'Game Development',
    prompt: 'Build a playable prototype demonstrating one original game mechanic you invented. 48-hour build limit from when you read this. Ship it — itch.io, GitHub Pages, or executable.',
    accepts: ['itch.io link', 'GitHub Pages URL', 'Executable + source']
  }
}

/* ════════════════════════════════════════
   APPLY WIZARD — DOMAIN GRID (from DB)
════════════════════════════════════════ */
async function loadApplyDomains() {
  if (!sb()) return
  const el = document.getElementById('domain-pick-grid')
  if (!el) return

  const { data } = await sb()
    .from('teams')
    .select('domain, name, tagline, icon, status, open_spots')
    .order('sort_order')

  if (!data || data.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);font-family:var(--mono);font-size:.8rem;grid-column:1/-1">No domains available right now.</p>'
    return
  }

  el.innerHTML = data.map(t => {
    const isWaitlist = t.status === 'waitlist'
    const isClosed   = t.status === 'closed'
    const disabled   = isWaitlist || isClosed
    const statusLabel = isWaitlist ? 'Waitlist' : isClosed ? 'Closed' : 'Open'
    const statusClass = isWaitlist ? 'waitlist' : isClosed ? 'closed' : 'open'

    return `
      <button class="domain-pick-card ${disabled ? statusClass : ''}"
        data-domain="${t.domain}"
        ${disabled ? 'disabled' : `onclick="pickDomain(this)"`}>
        <div class="dpc-icon">${t.icon || '◎'}</div>
        <div class="dpc-name">${t.name}</div>
        <div class="dpc-desc">${t.tagline || ''}</div>
        <div class="dpc-status ${statusClass}">${statusLabel}${!disabled && t.open_spots > 0 ? ` · ${t.open_spots} spot${t.open_spots > 1 ? 's' : ''}` : ''}</div>
      </button>
    `
  }).join('')

  // Reset wizard state when domains reload
  wizardState.domain = null
  document.getElementById('step1-next').disabled = true
}

let wizardState = {
  step:       1,
  domain:     null,
  submitMode: 'link'
}

function pickDomain(el) {
  document.querySelectorAll('.domain-pick-card').forEach(c => c.classList.remove('selected'))
  el.classList.add('selected')
  wizardState.domain = el.dataset.domain
  document.getElementById('step1-next').disabled = false
}
window.pickDomain = pickDomain

function goStep(n) {
  if (n === 3 && !validateStep2()) return
  if (n === 4) loadChallengeCard()

  for (let i = 1; i <= 4; i++) {
    const ws = document.getElementById('ws-' + i)
    ws.classList.remove('active', 'done')
    if (i < n) ws.classList.add('done')
    if (i === n) ws.classList.add('active')
  }
  document.querySelectorAll('.wizard-pane').forEach(p => p.classList.remove('active'))
  document.getElementById('wpane-' + n)?.classList.add('active')
  wizardState.step = n
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
window.goStep = goStep

function validateStep2() {
  const name  = document.getElementById('f-name').value.trim()
  const email = document.getElementById('f-email').value.trim()
  const age   = document.getElementById('f-age').value
  const err   = document.getElementById('step2-error')
  if (!name)  { showError(err, 'Please enter your full name.'); return false }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError(err, 'Please enter a valid email address.'); return false
  }
  if (!age)   { showError(err, 'Please select your age.'); return false }
  err.style.display = 'none'
  return true
}

function loadChallengeCard() {
  const exam = EXAM_PROMPTS[wizardState.domain]
  if (!exam) return
  document.getElementById('challenge-domain').textContent = exam.name.toUpperCase()
  document.getElementById('challenge-prompt').textContent = exam.prompt
  document.getElementById('challenge-accepts').innerHTML  = exam.accepts.map(a => `<div class="ca-item">${a}</div>`).join('')
}

function toggleSubmitMode(mode) {
  wizardState.submitMode = mode
  document.getElementById('sor-link').classList.toggle('checked', mode === 'link')
  document.getElementById('sor-file').classList.toggle('checked', mode === 'file')
  document.getElementById('so-link').classList.toggle('active', mode === 'link')
  document.getElementById('so-file').classList.toggle('active', mode === 'file')
  document.getElementById('sob-link').style.display = mode === 'link' ? '' : 'none'
  document.getElementById('sob-file').style.display = mode === 'file' ? '' : 'none'
}
window.toggleSubmitMode = toggleSubmitMode

function handleFileSelect(input) {
  const file = input.files[0]
  if (!file) return
  const el = document.getElementById('file-selected')
  el.textContent  = `✓ ${file.name} (${(file.size / 1024).toFixed(0)} KB)`
  el.style.display = 'block'
}
window.handleFileSelect = handleFileSelect

async function submitApplication() {
  const err  = document.getElementById('step4-error')
  const link = document.getElementById('f-link').value.trim()
  const note = document.getElementById('f-note').value.trim()
  const file = document.getElementById('f-file').files[0]
  const btn  = document.getElementById('submit-btn')

  if (wizardState.submitMode === 'link' && !link) {
    showError(err, 'Please paste your submission link.'); return
  }
  if (wizardState.submitMode === 'file' && !file) {
    showError(err, 'Please select a file to upload.'); return
  }
  err.style.display = 'none'
  btn.disabled      = true
  btn.textContent   = 'Submitting…'

  try {
    let submissionUrl = link || null

    // If file mode, upload to Supabase Storage first
    if (wizardState.submitMode === 'file' && file && sb()) {
      const ext      = file.name.split('.').pop()
      const path     = `submissions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error: uploadErr } = await sb().storage.from('submissions').upload(path, file)
      if (uploadErr) throw new Error('File upload failed: ' + uploadErr.message)
      submissionUrl = uploadData?.path || path
    }

    if (sb()) {
      const { error } = await sb().from('applications').insert({
        name:            document.getElementById('f-name').value.trim(),
        email:           document.getElementById('f-email').value.trim(),
        age:             document.getElementById('f-age').value,
        domain:          wizardState.domain,
        portfolio_url:   document.getElementById('f-portfolio').value.trim() || null,
        submission_url:  submissionUrl,
        submission_note: note || null,
      })
      if (error) throw new Error(error.message)
    } else {
      // Fallback: simulate for local dev
      await new Promise(r => setTimeout(r, 800))
    }

    showSuccess()
  } catch (e) {
    showError(err, e.message || 'Submission failed. Please try again.')
    btn.disabled    = false
    btn.textContent = 'Submit Application →'
  }
}
window.submitApplication = submitApplication

function showSuccess() {
  document.querySelectorAll('.wizard-pane').forEach(p => p.classList.remove('active'))
  document.getElementById('wpane-done').classList.add('active')
  document.getElementById('success-domain').textContent = EXAM_PROMPTS[wizardState.domain]?.name || wizardState.domain
  document.getElementById('success-email').textContent  = document.getElementById('f-email').value.trim()
}

/* ════════════════════════════════════════
   UTILS
════════════════════════════════════════ */
function showError(el, msg) {
  el.textContent   = msg
  el.style.display = 'block'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h    = Math.floor(diff / 36e5)
  if (h < 24)  return h + 'h ago'
  const d    = Math.floor(diff / 864e5)
  if (d < 30)  return d + 'd ago'
  return Math.floor(d / 30) + 'mo ago'
}

function initWizard() {
  toggleSubmitMode('link')
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initWizard()

  // Load all home page data
  loadTicker()
  loadHomeProjects()
  loadHomeLog()
  loadHomeEvents()
  loadAccountTasks()

  // Pre-load apply domains so they're ready if user goes straight to Apply
  loadApplyDomains()
})