-- ============================================================
-- HACKCLUB BATUMI — Supabase Schema
-- Paste into: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── TICKER ITEMS ───────────────────────────────────────────
create table if not exists ticker_items (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── PROJECTS ───────────────────────────────────────────────
create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  domain       text not null,       -- web | pcb | cad | robotics | ml | game
  title        text not null,
  description  text,
  status       text not null default 'building',  -- building | shipped
  contributors text[] default '{}',              -- ['AK','MT']
  badge_text   text,
  badge_type   text default 'green',             -- green | amber | blue | muted
  link_url     text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ─── TEAMS ──────────────────────────────────────────────────
create table if not exists teams (
  id               uuid primary key default gen_random_uuid(),
  domain           text unique not null,
  name             text not null,
  tagline          text,
  icon             text,
  status           text not null default 'open',  -- open | waitlist | closed
  leader_name      text,
  leader_initials  text,
  members          jsonb not null default '[]',   -- [{name, initials}]
  open_spots       int not null default 0,
  focus_text       text,
  stat_projects    int not null default 0,
  stat2_label      text,
  sort_order       int not null default 0
);

-- ─── WINS ───────────────────────────────────────────────────
create table if not exists wins (
  id          uuid primary key default gen_random_uuid(),
  place       text not null,                      -- '1ST' | '2ND' | 'YSWS ✓'
  place_type  text not null default 'gold',       -- gold | silver | accept
  event_name  text not null,
  title       text not null,
  description text,
  team_text   text,
  prize_text  text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── EVENTS ─────────────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  date_label  text not null,
  title       text not null,
  badge_type  text not null default 'muted',  -- green | amber | muted
  badge_text  text not null default 'plan',
  sort_order  int not null default 0,
  event_date  date
);

-- ─── ACTIVITY LOG ───────────────────────────────────────────
create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  hash        text not null,
  branch      text not null,
  message     text not null,
  time_label  text not null,
  created_at  timestamptz not null default now()
);

-- ─── MEMBERS ────────────────────────────────────────────────
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  full_name  text not null,
  domain     text,
  role       text not null default 'member',  -- member | leader | admin
  joined_at  timestamptz not null default now()
);

-- ─── ADMINS ─────────────────────────────────────────────────
create table if not exists admins (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade unique
);

-- ─── APPLICATIONS ───────────────────────────────────────────
create table if not exists applications (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text not null,
  age              text,
  domain           text not null,
  portfolio_url    text,
  submission_url   text,
  submission_note  text,
  status           text not null default 'pending',  -- pending | approved | rejected
  reviewer_note    text,
  submitted_at     timestamptz not null default now(),
  reviewed_at      timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table ticker_items  enable row level security;
alter table projects      enable row level security;
alter table teams         enable row level security;
alter table wins          enable row level security;
alter table events        enable row level security;
alter table activity_log  enable row level security;
alter table members       enable row level security;
alter table admins        enable row level security;
alter table applications  enable row level security;

-- Helper function: returns true if the calling user is in the admins table
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- Public read (no auth required)
create policy "public_read_ticker"   on ticker_items  for select using (true);
create policy "public_read_projects" on projects      for select using (true);
create policy "public_read_teams"    on teams         for select using (true);
create policy "public_read_wins"     on wins          for select using (true);
create policy "public_read_events"   on events        for select using (true);
create policy "public_read_log"      on activity_log  for select using (true);

-- Admin full access on content tables
create policy "admin_all_ticker"   on ticker_items  for all using (is_admin()) with check (is_admin());
create policy "admin_all_projects" on projects      for all using (is_admin()) with check (is_admin());
create policy "admin_all_teams"    on teams         for all using (is_admin()) with check (is_admin());
create policy "admin_all_wins"     on wins          for all using (is_admin()) with check (is_admin());
create policy "admin_all_events"   on events        for all using (is_admin()) with check (is_admin());
create policy "admin_all_log"      on activity_log  for all using (is_admin()) with check (is_admin());

-- Members: each user reads their own row; admin reads all
create policy "members_read_own"    on members for select using (user_id = auth.uid() or is_admin());
create policy "admin_write_members" on members for all    using (is_admin()) with check (is_admin());

-- Admins: each admin can read their own row
create policy "admins_read_own" on admins for select using (user_id = auth.uid());

-- Applications: anyone can submit; only admin can read/update/delete
create policy "anyone_submit_app"    on applications for insert with check (true);
create policy "admin_read_apps"      on applications for select using (is_admin());
create policy "admin_update_apps"    on applications for update using (is_admin()) with check (is_admin());
create policy "admin_delete_apps"    on applications for delete using (is_admin());

-- ============================================================
-- SEED DATA — mirrors placeholder content from the front-end
-- Run this block separately after the tables are created
-- ============================================================

insert into ticker_items (text, sort_order) values
  ('PCB Group — 1st place HardHack 2026', 1),
  ('Web team shipped: AI Tutor Platform — YSWS accepted', 2),
  ('Robotics: autonomous nav patch merged', 3),
  ('ML team — 800 GitHub stars overnight', 4),
  ('CAD: Robotic Arm v2 to FIRST competition', 5),
  ('Recruiting — Web · PCB · CAD · Robotics · Game Dev', 6);

insert into activity_log (hash, branch, message, time_label) values
  ('a3f92c', 'pcb',   'Won 1st place at HardHack 2026',     '2h ago'),
  ('b17e44', 'web',   'Shipped AI Tutor — YSWS accepted',   '5h ago'),
  ('c82a11', 'robot', 'Autonomous nav patch merged',         '1d ago'),
  ('d55f09', 'cad',   'Robotic Arm v2 to FIRST Robotics',   '2d ago'),
  ('e71c3a', 'ml',    'Object detection model — 800 stars', '3d ago');

insert into events (date_label, title, badge_type, badge_text, sort_order, event_date) values
  ('apr 12', 'YSWS Summer submissions open',   'green', 'soon', 1, '2026-04-12'),
  ('apr 19', 'TbilisiHack 2026 registration',  'amber', 'open', 2, '2026-04-19'),
  ('may 03', 'FIRST Robotics regional finals', 'muted', 'plan', 3, '2026-05-03'),
  ('may 17', 'HardHack 2026 Vol.2',            'muted', 'plan', 4, '2026-05-17');

insert into projects (domain, title, description, status, contributors, badge_text, badge_type, sort_order) values
  ('web',      'AI Tutor Platform',             'Adaptive learning with spaced repetition + LLM feedback loops.',    'shipped',  ARRAY['AK','MT'],      'YSWS ✓',    'green', 1),
  ('pcb',      'Custom RISC-V Board',           '4-layer PCB with soft-core RISC-V on FPGA. Won HardHack 2026.',    'shipped',  ARRAY['NB','KS'],      '🏆 1st',    'amber', 2),
  ('ml',       'Lightweight Object Detector',   'Under 500KB. Runs at 120fps on embedded hardware.',                'shipped',  ARRAY['GV'],           '⭐ 800',    'blue',  3),
  ('cad',      'Robotic Arm v2',                '6-DOF arm with sub-mm precision. Fully 3D printable.',             'shipped',  ARRAY['LR','AM'],      'FIRST 2026','muted', 4),
  ('robotics', 'SLAM Navigator',                'Indoor mapping and autonomous navigation on Raspberry Pi 4.',      'shipped',  ARRAY['NB'],           'Deployed',  'green', 5),
  ('game',     'Voxel Physics Engine',          'Custom voxel destruction in C++. Zero dependencies.',              'shipped',  ARRAY['DS','VN'],      'Shipped',   'green', 6),
  ('web',      'Open Source Analytics Dashboard','Privacy-first analytics. Self-hostable, no cookies.',             'building', ARRAY['AK','MT','DL'], 'Active',    'green', 7),
  ('robotics', 'Swarm Coordination Protocol',   'Distributed coordination for 3+ robots via IR mesh. FIRST 2026.', 'building', ARRAY['NB','KS'],      'In Review', 'amber', 8);

insert into teams (domain, name, tagline, icon, status, leader_name, leader_initials, members, open_spots, focus_text, stat_projects, stat2_label, sort_order) values
  ('web',      'WEB DEV',     'Full-stack · APIs · DevOps',         '⟨/⟩', 'open',     'Alex K.',   'AK', '[{"name":"M.Tsiklauri","initials":"MT"},{"name":"D.Loria","initials":"DL"}]', 1, 'Open Source Analytics Dashboard — ProductHunt launch in 3 weeks', 3, '2 YSWS wins',   1),
  ('pcb',      'ELECTRONICS', 'PCB · Embedded · RF · Power',        '⚡',   'open',     'Nika B.',   'NB', '[{"name":"K.Svanidze","initials":"KS"},{"name":"T.Jikia","initials":"TJ"}]',  1, 'RISC-V SoC on custom PCB — preparing for HardHack Vol.2',         2, '1 win',         2),
  ('cad',      'CAD',         'Mechanical · 3D Print · Fusion360',  '◈',    'open',     'Luka R.',   'LR', '[{"name":"A.Megrelishvili","initials":"AM"}]',                               2, 'Exoskeleton finger actuator prototype — with Robotics team',       1, '1 FIRST entry', 3),
  ('robotics', 'ROBOTICS',    'Control · SLAM · ROS2 · CV',         '⊕',    'open',     'Giorgi V.', 'GV', '[{"name":"N.Beriashvili","initials":"NB"},{"name":"K.S","initials":"KS"}]',  1, 'Swarm protocol for FIRST 2026 — 3 robot IR mesh coordination',     2, '2 deployed',    4),
  ('ml',       'ML / AI',     'Models · Edge AI · Research',        '◉',    'waitlist', 'Davit M.',  'DM', '[{"name":"G.Vekua","initials":"GV"}]',                                       0, 'Edge speech recognition for Georgian language — sub-200KB inference', 1, '800 ⭐',       5),
  ('game',     'GAME DEV',    'Engines · Graphics · Physics',       '▷',    'open',     'Dato S.',   'DS', '[{"name":"V.Nikolaishvili","initials":"VN"}]',                               2, 'Custom voxel physics engine in C++ — itch.io release + game jam',  1, '1 jam entry',   6);

insert into wins (place, place_type, event_name, title, description, team_text, prize_text, sort_order) values
  ('1ST',    'gold',   'HardHack 2026 — Electronics',  'Custom RISC-V Board',     '4-layer PCB with soft-core RISC-V. Judges called it production-grade from a student team.', 'PCB Group · Nika B. +2',       '$500 + Hardware',    1),
  ('YSWS ✓', 'accept', 'YSWS Spring 2026',             'AI Tutor Platform',        'Accepted to YSWS Spring cohort. Live and serving 200+ users.',                             'Web Group · Alex K. +1',       '$250 Grant',         2),
  ('1ST',    'gold',   'TbilisiHack 2025',             'Edge Object Detector',     'Sub-500KB inference demoed live on Raspberry Pi Zero.',                                    'ML Group · Davit M.',          '$300 + Mentorship',  3),
  ('2ND',    'silver', 'FIRST Robotics Regional 2025', 'Autonomous Nav Robot',     'Lost by 2 points in the final. Strongest mechanical design at the event.',                'Robotics + CAD · Giorgi V. +3','Regional Finalist',  4),
  ('YSWS ✓', 'accept', 'YSWS Fall 2025',               'PWM Motor Controller',     'Fully open source. Used in 12+ derivative projects globally.',                            'PCB Group · K.Svanidze',       '$200 Grant',         5),
  ('1ST',    'gold',   'HackGeorgia Mini 2025',        'DevOps Monitor Pro',       'Shipped in 24 hours. Judge said it could be a real product.',                             'Web Group · M.Tsiklauri',      '$150 + AWS Credits', 6);

-- ============================================================
-- HOW TO ADD YOURSELF AS ADMIN
-- After creating your admin user via Supabase Auth dashboard:
--
--   insert into admins (user_id)
--   values ('<paste-your-user-uuid-here>');
--
-- ============================================================
