-- Apply after the existing authentication and inventory RLS migration.
-- Adds the locality lookup table and shell price/locality foreign key.
create table if not exists public.shell_locality (
  locality_id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  locality text null,
  constraint shell_locality_pkey primary key (locality_id)
);

alter table public.shell_description
  add column if not exists price numeric null,
  add column if not exists locality_id uuid null;

-- Preserve existing locality strings when upgrading from the previous schema.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_description' and column_name = 'locality'
  ) then
    insert into public.shell_locality (locality)
    select distinct old.locality
    from public.shell_description as old
    where old.locality is not null
      and not exists (
        select 1 from public.shell_locality as current
        where current.locality is not distinct from old.locality
      );

    update public.shell_description as shell
    set locality_id = locality.locality_id
    from public.shell_locality as locality
    where shell.locality_id is null
      and shell.locality is not null
      and locality.locality is not distinct from shell.locality;

    alter table public.shell_description drop column locality;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shell_description'::regclass
      and conname = 'shell_description_locality_id_fkey'
  ) then
    alter table public.shell_description
      add constraint shell_description_locality_id_fkey
      foreign key (locality_id) references public.shell_locality (locality_id);
  end if;
end $$;

alter table public.shell_locality enable row level security;
grant select on public.shell_locality to anon, authenticated;
grant insert, update, delete on public.shell_locality to authenticated;

-- Use the existing database-backed staff roles without relying on client claims.
create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.can_manage_shell_localities()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role::text in ('admin', 'superadmin')
  );
$$;
revoke all on function private.can_manage_shell_localities() from public, anon;
grant execute on function private.can_manage_shell_localities() to authenticated;

drop policy if exists "Public can read shell localities" on public.shell_locality;
create policy "Public can read shell localities"
  on public.shell_locality for select to anon, authenticated using (true);

drop policy if exists "Admins can insert shell localities" on public.shell_locality;
create policy "Admins can insert shell localities"
  on public.shell_locality for insert to authenticated
  with check (private.can_manage_shell_localities());

drop policy if exists "Admins can update shell localities" on public.shell_locality;
create policy "Admins can update shell localities"
  on public.shell_locality for update to authenticated
  using (private.can_manage_shell_localities())
  with check (private.can_manage_shell_localities());

drop policy if exists "Admins can delete shell localities" on public.shell_locality;
create policy "Admins can delete shell localities"
  on public.shell_locality for delete to authenticated
  using (private.can_manage_shell_localities());
