// js/auth.js
// Handles login, register, logout, and account page population via Supabase Auth.

const SUPABASE_URL      = 'https://omcopzvlsydauozhurir.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_KrdBwM6qCkUGTuHVhPmxgg_zWF38WR0'

// Create client and expose it globally so app.js can reuse the same instance
const _sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window._sb = _sb

/* ════════════════════════════════════════
   SESSION MANAGEMENT
════════════════════════════════════════ */
async function initAuth() {
  if (!_sb) return

  const { data: { session } } = await _sb.auth.getSession()
  updateNavForAuth(session)
  if (session) loadAccountPage(session)

  _sb.auth.onAuthStateChange((event, session) => {
    updateNavForAuth(session)
    if (event === 'SIGNED_IN') {
      loadAccountPage(session)
      if (document.getElementById('page-login').classList.contains('active')) {
        showPage('account')
      }
    }
    if (event === 'SIGNED_OUT') {
      showPage('home')
    }
  })
}

function updateNavForAuth(session) {
  const loginBtn   = document.getElementById('nav-login')
  const accountBtn = document.getElementById('nav-account')
  if (session) {
    if (loginBtn)   loginBtn.style.display   = 'none'
    if (accountBtn) accountBtn.style.display = ''
  } else {
    if (loginBtn)   loginBtn.style.display   = ''
    if (accountBtn) accountBtn.style.display = 'none'
  }
}

/* ════════════════════════════════════════
   LOGIN
════════════════════════════════════════ */
async function doLogin() {
  if (!_sb) { alert('Auth not configured yet.'); return }
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const errEl    = document.getElementById('login-error')
  if (!email || !password) { showAuthError(errEl, 'Please fill in email and password.'); return }
  const { error } = await _sb.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = error.message === 'Invalid login credentials'
      ? 'Wrong email or password. If you were just approved, use the magic link in your email.'
      : error.message
    showAuthError(errEl, msg)
    return
  }
  errEl.style.display = 'none'
}
window.doLogin = doLogin

/* ════════════════════════════════════════
   MAGIC LINK
════════════════════════════════════════ */
async function doMagicLink() {
  if (!_sb) { alert('Auth not configured yet.'); return }
  const email = document.getElementById('login-email').value.trim()
  const errEl = document.getElementById('login-error')
  if (!email) { showAuthError(errEl, 'Enter your email first.'); return }
  const { error } = await _sb.auth.signInWithOtp({ email })
  if (error) { showAuthError(errEl, error.message); return }
  errEl.style.display = 'none'
  document.getElementById('apane-login').innerHTML = `
    <div style="text-align:center;padding:1rem 0">
      <div style="font-size:2rem;margin-bottom:1rem">✉️</div>
      <p style="font-family:var(--mono);font-size:.85rem;color:var(--text);line-height:1.7">
        Magic link sent to <strong>${email}</strong>.<br>
        Check your inbox and click the link to log in.
      </p>
    </div>
  `
}
window.doMagicLink = doMagicLink

/* ════════════════════════════════════════
   REGISTER
════════════════════════════════════════ */
async function doRegister() {
  if (!_sb) { alert('Auth not configured yet.'); return }
  const pass1  = document.getElementById('reg-password').value
  const pass2  = document.getElementById('reg-password2').value
  const errEl  = document.getElementById('register-error')
  if (!pass1 || !pass2) { showAuthError(errEl, 'Please fill in all fields.'); return }
  if (pass1.length < 8)  { showAuthError(errEl, 'Password must be at least 8 characters.'); return }
  if (pass1 !== pass2)   { showAuthError(errEl, 'Passwords do not match.'); return }
  // updateUser works only after logging in via magic link from the approval email
  const { error } = await _sb.auth.updateUser({ password: pass1 })
  if (error) {
    showAuthError(errEl, 'Please use the magic link from your approval email to set your password.')
    return
  }
  errEl.style.display = 'none'
  showPage('account')
}
window.doRegister = doRegister

/* ════════════════════════════════════════
   LOGOUT
════════════════════════════════════════ */
async function doLogout() {
  if (!_sb) return
  await _sb.auth.signOut()
}
window.doLogout = doLogout

/* ════════════════════════════════════════
   AUTH TAB SWITCH
════════════════════════════════════════ */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.auth-pane').forEach(p => p.classList.remove('active'))
  document.getElementById('tab-' + tab).classList.add('active')
  document.getElementById('apane-' + tab).classList.add('active')
}
window.switchAuthTab = switchAuthTab

/* ════════════════════════════════════════
   ACCOUNT PAGE
════════════════════════════════════════ */
async function loadAccountPage(session) {
  if (!_sb || !session) return

  const { data: member } = await _sb
    .from('members')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (!member) return

  const domainNames = { web:'Web Dev', pcb:'Electronics', cad:'CAD', robotics:'Robotics', ml:'ML/AI', game:'Game Dev' }
  const initials    = member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  document.getElementById('acct-avatar').textContent  = initials
  document.getElementById('acct-name').textContent    = member.full_name
  document.getElementById('acct-domain').textContent  = domainNames[member.domain] || member.domain
  document.getElementById('acct-role').textContent    = member.role.charAt(0).toUpperCase() + member.role.slice(1)
  document.getElementById('acct-join').textContent    = 'Joined ' + new Date(member.joined_at).toLocaleDateString('en-US', { month:'long', year:'numeric' })
  document.getElementById('gc-name').textContent      = (domainNames[member.domain] || member.domain) + ' Group'

  // Months active
  const months = Math.max(1, Math.round((Date.now() - new Date(member.joined_at)) / (1000 * 60 * 60 * 24 * 30)))
  document.getElementById('acct-stat-months').textContent = months + 'mo'

  // Load member's team info
  const { data: team } = await _sb
    .from('teams')
    .select('leader_name, focus_text, stat_projects, stat2_label, members')
    .eq('domain', member.domain)
    .single()

  if (team) {
    document.getElementById('gc-meta').textContent  = `${(team.members?.length || 0) + 1} members · ${team.leader_name} leads`
    document.getElementById('gc-focus').textContent = 'Currently: ' + (team.focus_text || '—')
    document.getElementById('acct-stat-projects').textContent = team.stat_projects || '0'
  }

  // Load member's YSWS wins from wins table
  const { data: yswsWins } = await _sb
    .from('wins')
    .select('id')
    .eq('place_type', 'accept')

  document.getElementById('acct-stat-wins').textContent = yswsWins?.length || '0'

  // Logbook — activity log entries filtered to member's domain
  const { data: logEntries } = await _sb
    .from('activity_log')
    .select('*')
    .eq('branch', member.domain)
    .order('created_at', { ascending: false })
    .limit(5)

  const logEl = document.getElementById('logbook-entries')
  if (logEntries && logEntries.length > 0) {
    logEl.innerHTML = logEntries.map(e => `
      <div class="lb-entry">
        <div class="lb-dot"></div>
        <div class="lb-content">
          <div class="lb-title">${e.message}</div>
          <div class="lb-date">${e.time_label}</div>
        </div>
      </div>
    `).join('')
  } else {
    logEl.innerHTML = '<div class="lb-entry"><div class="lb-dot"></div><div class="lb-content"><div class="lb-title" style="color:var(--muted)">No activity logged yet.</div></div></div>'
  }
}

/* ════════════════════════════════════════
   UTILS
════════════════════════════════════════ */
function showAuthError(el, msg) {
  el.textContent   = msg
  el.style.display = 'block'
}

document.addEventListener('DOMContentLoaded', initAuth)