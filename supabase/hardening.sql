begin;
alter table public.stores add column is_demo boolean not null default false;
alter table public.stores add column version integer not null default 1;
alter table public.floors add column version integer not null default 1;
alter table public.products add column version integer not null default 1;
alter table public.floor_access_points add column version integer not null default 1;

create function public.bump_record_version() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.version := old.version+1; return new; end; $$;
create trigger store_version before update on public.stores for each row execute function public.bump_record_version();
create trigger floor_version before update on public.floors for each row execute function public.bump_record_version();
create trigger product_version before update on public.products for each row execute function public.bump_record_version();
create trigger access_version before update on public.floor_access_points for each row execute function public.bump_record_version();

create function public.validate_floor_change() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.store_id <> old.store_id then raise exception 'Move floors by creating a new floor, not reassigning ownership'; end if;
  if exists(select 1 from public.shelves s where s.floor_id=old.id and
    (s.x+(abs(cos(radians(s.rotation)))*s.width+abs(sin(radians(s.rotation)))*s.depth)/2>new.width or
    s.z+(abs(sin(radians(s.rotation)))*s.width+abs(cos(radians(s.rotation)))*s.depth)/2>new.depth)) then raise exception 'New bounds exclude existing shelves'; end if;
  if exists(select 1 from public.floor_access_points p where p.floor_id=old.id and (p.x>new.width or p.z>new.depth)) then raise exception 'New bounds exclude access points'; end if;
  return new;
end; $$;
create trigger floor_bounds before update on public.floors for each row execute function public.validate_floor_change();
create function public.validate_product_owner() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.store_id <> old.store_id then raise exception 'Product ownership cannot be reassigned'; end if;
  new.updated_at := now(); return new;
end; $$;
create trigger product_owner before update on public.products for each row execute function public.validate_product_owner();

create function public.import_records(target_table text, rows jsonb) returns integer language plpgsql security invoker set search_path = '' as $$
declare row_data jsonb; fields text; values_sql text; total integer:=0;
begin
  if target_table not in ('floors','shelves','products','product_locations','floor_access_points') then raise exception 'Unsupported import table'; end if;
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>200 or jsonb_array_length(rows)=0 then raise exception 'Import must contain 1 to 200 records'; end if;
  for row_data in select value from jsonb_array_elements(rows) loop
    if jsonb_typeof(row_data)<>'object' then raise exception 'Expected record'; end if;
    if exists(select 1 from jsonb_object_keys(row_data) k where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=target_table and c.column_name=k)) then raise exception 'Unknown column'; end if;
    select string_agg(format('%I',k),','), string_agg(format('(r).%I',k),',') into fields,values_sql from jsonb_object_keys(row_data) k;
    execute format('insert into public.%I (%s) select %s from (select jsonb_populate_record(null::public.%I, $1) r) t',target_table,fields,values_sql,target_table) using row_data;
    total:=total+1;
  end loop;
  return total;
end; $$;
revoke all on function public.import_records(text,jsonb) from public, anon;
grant execute on function public.import_records(text,jsonb) to authenticated;

create function public.update_layout(rows jsonb) returns integer language plpgsql security invoker set search_path = '' as $$
declare item jsonb; affected integer; total integer:=0;
begin
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>200 or jsonb_array_length(rows)=0 then raise exception 'Layout must contain 1 to 200 shelves'; end if;
  for item in select value from jsonb_array_elements(rows) loop
    update public.shelves set x=(item->>'x')::real,z=(item->>'z')::real,width=(item->>'width')::real,depth=(item->>'depth')::real,rotation=(item->>'rotation')::real where id=item->>'id' and version=(item->>'version')::integer;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Layout conflict or permission denied'; end if;
    total:=total+1;
  end loop;
  return total;
end; $$;
revoke all on function public.update_layout(jsonb) from public, anon;
grant execute on function public.update_layout(jsonb) to authenticated;
commit;
