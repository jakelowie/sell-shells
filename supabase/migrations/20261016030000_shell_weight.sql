-- Add the nullable numeric shell weight field.
alter table public.shell_description
  add column if not exists shell_weight numeric null;
