-- Picture shown on the music icon (for YouTube tracks: the channel's profile photo).
alter table public.music_tracks
  add column artwork_url text check (artwork_url is null or artwork_url ~ '^https://');
