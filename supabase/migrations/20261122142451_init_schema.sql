-- ============ Helpers ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ profiles ============
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id) select id from auth.users on conflict do nothing;

-- ============ journal_entries ============
create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       varchar(200) not null check (char_length(btrim(title)) > 0),
  body        text,
  entry_date  date not null default current_date,
  location    text,
  mood        varchar(50),
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ============ media_assets ============
create table public.media_assets (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_path      text not null,
  thumbnail_path text,
  media_type     text not null check (media_type in ('IMAGE', 'VIDEO')),
  mime_type      text not null,
  file_size      bigint not null check (file_size > 0),
  duration_ms    bigint check (duration_ms >= 0),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (id, user_id),
  foreign key (entry_id, user_id) references public.journal_entries (id, user_id) on delete cascade
);

create index media_assets_entry_order_idx on public.media_assets (entry_id, sort_order);

-- ============ music_tracks ============
create table public.music_tracks (
  id               uuid primary key default gen_random_uuid(),
  media_asset_id   uuid not null unique,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source           text not null check (source in ('upload', 'youtube')),
  storage_path     text,
  youtube_video_id text check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title            varchar(200) not null,
  artist           varchar(200),
  start_ms         bigint not null default 0 check (start_ms >= 0),
  end_ms           bigint check (end_ms is null or end_ms > start_ms),
  volume           numeric(3,2) not null default 1 check (volume between 0 and 1),
  lyrics_offset_ms integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  foreign key (media_asset_id, user_id) references public.media_assets (id, user_id) on delete cascade,
  check (
    (source = 'upload'  and storage_path is not null and youtube_video_id is null) or
    (source = 'youtube' and youtube_video_id is not null and storage_path is null)
  )
);

create trigger music_tracks_updated_at before update on public.music_tracks
  for each row execute function public.set_updated_at();

-- ============ lyric_lines ============
create table public.lyric_lines (
  id         uuid primary key default gen_random_uuid(),
  track_id   uuid not null,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text       text not null,
  start_ms   bigint not null check (start_ms >= 0),
  end_ms     bigint check (end_ms is null or end_ms > start_ms),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (track_id, user_id) references public.music_tracks (id, user_id) on delete cascade
);

create index lyric_lines_track_time_idx on public.lyric_lines (track_id, start_ms);

-- ============ Row Level Security ============
alter table public.profiles        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.media_assets    enable row level security;
alter table public.music_tracks    enable row level security;
alter table public.lyric_lines     enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "entries_owner_all" on public.journal_entries
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "media_owner_all" on public.media_assets
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "tracks_owner_all" on public.music_tracks
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "lyrics_owner_all" on public.lyric_lines
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
