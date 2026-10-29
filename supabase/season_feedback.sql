-- =============================================================================
-- season_feedback — anonymous Season 2026 feedback (feedback.html)
-- -----------------------------------------------------------------------------
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Deliberately holds nothing that could tie a response to a player: no user
-- id, name, email, phone, IP, or device. submitted_at is the DATE only — in a
-- league this size an exact time can point to a person.
--
-- Anyone can submit (the public site key). Responses are readable so the
-- admin page can show them, and nobody can edit or delete them through the
-- API — there are no update/delete policies.
-- =============================================================================

create table if not exists public.season_feedback (
  id                bigint generated always as identity primary key,
  submitted_at      date not null default (now() at time zone 'America/New_York')::date,
  overall_rating    smallint not null check (overall_rating between 1 and 5),
  likelihood_return smallint not null check (likelihood_return between 0 and 10),
  liked_aspects     text[] not null default '{}'
                    check (liked_aspects <@ array['format','rating','communication','tournament','community','website','other']::text[]),
  change_aspects    text[] not null default '{}'
                    check (change_aspects <@ array['format','rating','communication','tournament','community','website','other']::text[]),
  one_change        text check (char_length(one_change) <= 200),
  other_comments    text check (char_length(other_comments) <= 2000)
);

alter table public.season_feedback enable row level security;

drop policy if exists "Anyone can submit feedback" on public.season_feedback;
create policy "Anyone can submit feedback"
  on public.season_feedback for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admin page can read feedback" on public.season_feedback;
create policy "Admin page can read feedback"
  on public.season_feedback for select
  to anon, authenticated
  using (true);

grant insert, select on public.season_feedback to anon, authenticated;
revoke update, delete, truncate on public.season_feedback from anon, authenticated;
