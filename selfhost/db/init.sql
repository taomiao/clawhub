-- Minimal schema for self-hosted ClawHub API (MVP).

create table if not exists users (
  id bigserial primary key,
  handle text unique,
  display_name text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists api_tokens (
  id bigserial primary key,
  token_hash text not null unique,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists skills (
  id bigserial primary key,
  slug text not null unique,
  display_name text not null,
  summary text,
  owner_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists skill_versions (
  id bigserial primary key,
  skill_id bigint not null references skills(id) on delete cascade,
  version text not null,
  changelog text not null default '',
  bundle_hash text not null,
  created_at timestamptz not null default now(),
  unique(skill_id, version)
);

create table if not exists skill_tags (
  skill_id bigint not null references skills(id) on delete cascade,
  tag text not null,
  version_id bigint not null references skill_versions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(skill_id, tag)
);

create table if not exists skill_files (
  id bigserial primary key,
  version_id bigint not null references skill_versions(id) on delete cascade,
  path text not null,
  size bigint not null,
  sha256 text not null,
  content_type text,
  storage_key text not null,
  created_at timestamptz not null default now(),
  unique(version_id, path)
);

create index if not exists idx_skill_versions_bundle_hash on skill_versions(bundle_hash);
create index if not exists idx_skill_files_version_id on skill_files(version_id);

