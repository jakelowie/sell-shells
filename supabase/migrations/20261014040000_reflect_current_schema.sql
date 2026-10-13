do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_description' and column_name = 'id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_description' and column_name = 'shell_id'
  ) then
    alter table public.shell_description rename column id to shell_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_description' and column_name = 'stock_type_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_description' and column_name = 'shell_stock_type_id'
  ) then
    alter table public.shell_description rename column stock_type_id to shell_stock_type_id;
  end if;

  if to_regclass('public.stock_info') is not null and to_regclass('public.shell_stocks_info') is null then
    alter table public.stock_info rename to shell_stocks_info;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_stocks_info' and column_name = 'id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_stocks_info' and column_name = 'stock_info_id'
  ) then
    alter table public.shell_stocks_info rename column id to stock_info_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_images' and column_name = 'id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shell_images' and column_name = 'image_id'
  ) then
    alter table public.shell_images rename column id to image_id;
  end if;
end $$;

create table if not exists public.shell_type (
  type_id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  shell_type_name text null default ''::text,
  constraint shell_type_pkey primary key (type_id)
);

alter table public.shell_description
  add column if not exists shell_stock_type_id uuid,
  add column if not exists shell_type_id uuid;

alter table public.shell_stocks_info
  add column if not exists shell_total_available numeric;

create unique index if not exists shell_images_storage_path_key
  on public.shell_images using btree (storage_path)
  where storage_path is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.shell_description'::regclass and conname = 'shell_description_shell_stock_type_id_fkey') then
    alter table public.shell_description
      add constraint shell_description_shell_stock_type_id_fkey
      foreign key (shell_stock_type_id) references public.shell_stock_type (stock_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shell_description'::regclass and conname = 'shell_description_shell_type_id_fkey') then
    alter table public.shell_description
      add constraint shell_description_shell_type_id_fkey
      foreign key (shell_type_id) references public.shell_type (type_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shell_stocks_info'::regclass and conname = 'stock_info_shell_id_fkey') then
    alter table public.shell_stocks_info
      add constraint stock_info_shell_id_fkey
      foreign key (shell_id) references public.shell_description (shell_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shell_stocks_info'::regclass and conname = 'stock_info_shell_stock_id_fkey') then
    alter table public.shell_stocks_info
      add constraint stock_info_shell_stock_id_fkey
      foreign key (shell_stock_id) references public.shell_stock_type (stock_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.shell_images'::regclass and conname = 'shell_images_shell_id_fkey') then
    alter table public.shell_images
      add constraint shell_images_shell_id_fkey
      foreign key (shell_id) references public.shell_description (shell_id) on delete restrict;
  end if;
end $$;
