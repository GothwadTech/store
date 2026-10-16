-- ═══════════════════════════════════════════════════════════════════
-- GOTHWAD STORE - SQL File 01: StoreSchema
-- ⚠️ SIRF Store ke APNE Supabase project me chalao (sql/README.md pehle padho).
--    Accounts / Mail ke projects me BILKUL NAHI.
--
-- ♻️ IDEMPOTENT: yeh file dobara chalane par ERROR NAHI degi - chahe pehle
--    aadhi chali ho ya poori. Fresh project par bhi successful, purane par
--    bhi (latest changes apply ho jayenge). Pattern har nayi SQL me rakho:
--    create table if not exists · add column if not exists ·
--    drop policy if exists · insert ... on conflict do update.
--
-- Supabase yahan SIRF database hai - files ImgBB/GitHub/Backblaze par hain,
-- isiliye Storage bucket yahan NAHI banta.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.developers (
  id text primary key,
  user_id text not null,                 -- Gothwad Accounts ka sub (uuid)
  username text not null,
  display_name text not null,
  org_name text not null default '',
  support_email text not null default '',
  website text,
  logo_url text,                         -- ImgBB URL
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  slug text primary key,
  name text not null,
  kind text not null default 'both' check (kind in ('app','game','both')),
  icon text not null default 'LayoutGrid'
);

create table if not exists public.apps (
  id text primary key,
  developer_id text not null references public.developers(id) on delete cascade,
  package_name text not null unique,
  name text not null,
  category text not null references public.categories(slug),
  kind text not null default 'app' check (kind in ('app','game')),
  status text not null default 'draft' check (status in ('draft','in_review','published','unlisted','suspended')),
  short_desc text not null default '',
  full_desc text not null default '',
  icon_url text not null default '',        -- ImgBB URL
  feature_graphic_url text,                 -- ImgBB URL
  tags text[] not null default '{}',
  support_email text not null default '',
  website text,
  privacy_policy_url text,
  rating_avg numeric(2,1) not null default 0,
  rating_count integer not null default 0,
  downloads_count bigint not null default 0,
  featured text check (featured in ('hero','editors','top_new')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_releases (
  id text primary key,
  app_id text not null references public.apps(id) on delete cascade,
  version_code integer not null,
  version_name text not null,
  apk_provider text not null check (apk_provider in ('github','b2')),  -- <=25MB github, >25MB b2
  apk_key text not null default '',
  apk_url text not null default '',
  apk_size_bytes bigint not null default 0,
  apk_sha256 text,
  min_sdk integer,
  target_sdk integer,
  permissions text[] not null default '{}',
  changelog text not null default '',
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  review_note text,
  is_live boolean not null default false,
  downloads bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (app_id, version_code)
);

create table if not exists public.app_screenshots (
  id text primary key,
  app_id text not null references public.apps(id) on delete cascade,
  url text not null,                        -- ImgBB URL
  provider text not null default 'imgbb',
  sort_order integer not null default 0,
  type text not null default 'phone'
);

create table if not exists public.reviews (
  id text primary key,
  app_id text not null references public.apps(id) on delete cascade,
  user_id text not null,
  username text not null,
  rating integer not null check (rating between 1 and 5),
  body text not null default '',
  developer_reply text,
  developer_reply_at timestamptz,
  created_at timestamptz not null default now(),
  unique (app_id, user_id)
);

create table if not exists public.wishlists (
  user_id text not null,
  app_id text not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

create table if not exists public.downloads (
  id bigint generated always as identity primary key,
  app_id text not null references public.apps(id) on delete cascade,
  release_id text references public.app_releases(id) on delete set null,
  user_id text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.library (
  user_id text not null,
  app_id text not null references public.apps(id) on delete cascade,
  first_downloaded_at timestamptz not null default now(),
  last_version_code integer,
  primary key (user_id, app_id)
);

create table if not exists public.review_submissions (
  id text primary key,
  app_id text not null references public.apps(id) on delete cascade,
  release_id text not null references public.app_releases(id) on delete cascade,
  submitted_by text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_username text,
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.reports (
  id text primary key,
  app_id text not null references public.apps(id) on delete cascade,
  reporter_user_id text not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.featured (
  id text primary key,
  app_id text not null references public.apps(id) on delete cascade,
  section text not null check (section in ('hero','editors_choice','top_new')),
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz
);

create index if not exists idx_apps_status on public.apps(status);
create index if not exists idx_apps_category on public.apps(category);
create index if not exists idx_releases_app on public.app_releases(app_id);
create index if not exists idx_reviews_app on public.reviews(app_id);
create index if not exists idx_downloads_app_created on public.downloads(app_id, created_at);

-- ── RLS: sab par ON. Worker service_role se likhta hai (RLS bypass).
--    Public ko sirf published apps padhne do (anon key kabhi frontend me
--    jaati bhi hai to nuqsan nahi).
alter table public.developers enable row level security;
alter table public.categories enable row level security;
alter table public.apps enable row level security;
alter table public.app_releases enable row level security;
alter table public.app_screenshots enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.downloads enable row level security;
alter table public.library enable row level security;
alter table public.review_submissions enable row level security;
alter table public.reports enable row level security;
alter table public.featured enable row level security;

drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories for select using (true);
drop policy if exists "apps_read_published" on public.apps;
create policy "apps_read_published" on public.apps for select using (status = 'published');
drop policy if exists "screenshots_read" on public.app_screenshots;
create policy "screenshots_read" on public.app_screenshots for select using (true);
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews for select using (true);
drop policy if exists "featured_read" on public.featured;
create policy "featured_read" on public.featured for select using (true);

-- ── Categories seed ────────────────────────────────────────────────
insert into public.categories (slug, name, kind, icon) values
  ('communication','Communication','both','MessageCircle'),
  ('tools','Tools & Utilities','app','Wrench'),
  ('browser','Browsers','app','Globe'),
  ('productivity','Productivity','app','CheckSquare'),
  ('education','Education','app','GraduationCap'),
  ('entertainment','Entertainment','both','PlayCircle'),
  ('music','Music & Audio','app','Music'),
  ('photo','Photography','app','Camera'),
  ('games-action','Action Games','game','Swords'),
  ('games-puzzle','Puzzle Games','game','Puzzle'),
  ('games-racing','Racing Games','game','Car'),
  ('finance','Finance','app','Wallet')
-- Dobara run par latest naam/kind/icon update ho jaye (purane setup par bhi)
on conflict (slug) do update set
  name = excluded.name,
  kind = excluded.kind,
  icon = excluded.icon;
