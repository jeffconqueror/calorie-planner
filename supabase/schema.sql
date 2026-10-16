-- Run once in the project's SQL editor (safe to run again).
-- The browser uses ONLY a publishable/anon key and a signed-in user's JWT.
create table if not exists public.load_sync_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  document jsonb not null default '{"version":1,"records":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.load_sync_documents enable row level security;
revoke all on public.load_sync_documents from anon, authenticated;
grant select on public.load_sync_documents to authenticated;
drop policy if exists load_read_own on public.load_sync_documents;
create policy load_read_own on public.load_sync_documents for select to authenticated
  using ((select auth.uid()) = user_id);

-- Atomic compare-and-swap. Two devices cannot both overwrite the same revision.
-- No caller-supplied user id; ownership always comes from the verified JWT.
create or replace function public.load_sync_commit(p_revision bigint, p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_row public.load_sync_documents%rowtype;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_revision is null or p_revision < 0 or p_document is null
     or jsonb_typeof(p_document) is distinct from 'object'
     or p_document->>'version' is distinct from '1'
     or jsonb_typeof(p_document->'records') is distinct from 'object'
     or octet_length(p_document::text) > 10485760 then
    raise exception 'Invalid sync document' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_document->'records') r
    where length(r.key) > 240 or jsonb_typeof(r.value) is distinct from 'object'
      or not (r.value ? 'value' or r.value = '{"deleted":true}'::jsonb)) then
    raise exception 'Invalid sync record' using errcode = '22023';
  end if;
  insert into public.load_sync_documents(user_id) values (uid) on conflict do nothing;
  select * into current_row from public.load_sync_documents where user_id = uid for update;
  if current_row.revision <> p_revision then
    return jsonb_build_object('accepted',false,'revision',current_row.revision,'document',current_row.document);
  end if;
  update public.load_sync_documents set document = p_document, revision = revision + 1, updated_at = now()
    where user_id = uid returning * into current_row;
  return jsonb_build_object('accepted',true,'revision',current_row.revision,'document',current_row.document);
end;
$$;
revoke all on function public.load_sync_commit(bigint,jsonb) from public, anon;
grant execute on function public.load_sync_commit(bigint,jsonb) to authenticated;
