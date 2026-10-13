begin;
alter table public.floors add column updated_at timestamptz not null default now();
alter table public.shelves add column updated_at timestamptz not null default now();
alter table public.product_locations add column updated_at timestamptz not null default now();
alter table public.floor_access_points add column updated_at timestamptz not null default now();
create or replace function public.bump_record_version() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.version:=old.version+1; new.updated_at:=now(); return new; end; $$;
create function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at:=now(); return new; end; $$;
create trigger shelf_timestamp before update on public.shelves for each row execute function public.touch_updated_at();
create trigger location_timestamp before update on public.product_locations for each row execute function public.touch_updated_at();
commit;
