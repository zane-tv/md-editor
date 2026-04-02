create extension if not exists pgcrypto;

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  schema_version integer not null default 1,
  markdown text not null,
  view_mode text not null check (view_mode in ('split', 'edit', 'preview')),
  created_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  expires_at timestamptz
);

create index if not exists shares_expires_at_idx on public.shares (expires_at);

alter table public.shares enable row level security;

create or replace function public.create_share(markdown text, view_mode text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  share_id uuid;
begin
  if octet_length(markdown) > 716800 then
    raise exception 'Share content exceeds the current size limit.';
  end if;

  insert into public.shares (markdown, view_mode)
  values (
    markdown,
    case
      when view_mode in ('split', 'edit', 'preview') then view_mode
      else 'preview'
    end
  )
  returning id into share_id;

  return share_id;
end;
$$;

create or replace function public.load_share(share_id uuid)
returns table(status text, markdown text, view_mode text)
language plpgsql
security definer
set search_path = public
as $$
declare
  share_row public.shares%rowtype;
begin
  select * into share_row
  from public.shares
  where id = share_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  if share_row.expires_at is not null and share_row.expires_at <= now() then
    return query select 'expired'::text, null::text, null::text;
    return;
  end if;

  if share_row.first_viewed_at is null or share_row.expires_at is null then
    update public.shares
    set first_viewed_at = coalesce(first_viewed_at, now()),
        expires_at = coalesce(expires_at, now() + interval '1 day')
    where id = share_id;
  end if;

  return query select 'ready'::text, share_row.markdown, share_row.view_mode;
end;
$$;

revoke all on table public.shares from public;
revoke all on table public.shares from anon, authenticated;
revoke all on function public.create_share(text, text) from public;
revoke all on function public.load_share(uuid) from public;
grant execute on function public.create_share(text, text) to anon, authenticated;
grant execute on function public.load_share(uuid) to anon, authenticated;
