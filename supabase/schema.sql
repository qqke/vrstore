-- Install once in a new, dedicated Supabase project. Transactional and non-destructive.
begin;

create table public.stores (
  id text primary key, name text not null, address text not null default '',
  published boolean not null default false, updated_at timestamptz not null default now()
);
create table public.floors (
  id text primary key, store_id text not null references public.stores(id) on delete restrict,
  name text not null, sort_order integer not null, width real not null check(width > 0),
  depth real not null check(depth > 0), category text not null default '', published boolean not null default false,
  unique(store_id, name), unique(store_id, sort_order)
);
create table public.store_admins (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id text not null references public.stores(id) on delete restrict,
  primary key(user_id, store_id)
);
alter table public.store_admins enable row level security;
revoke all on public.store_admins from anon, authenticated;
grant select on public.store_admins to authenticated;
create policy read_own_grants on public.store_admins for select to authenticated using(user_id = (select auth.uid()));

create function public.is_store_admin(target_store text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.store_admins where store_id = target_store and user_id = (select auth.uid()));
$$;
revoke all on function public.is_store_admin(text) from public, anon;
grant execute on function public.is_store_admin(text) to authenticated;

create table public.shelves (
  id text primary key, floor_id text not null references public.floors(id) on delete restrict,
  code text not null, category text not null default '', x real not null check(x >= 0), z real not null check(z >= 0),
  width real not null check(width > 0), depth real not null check(depth > 0), rotation real not null default 0 check(rotation >= 0 and rotation < 360),
  levels integer not null default 5 check(levels between 1 and 20), version integer not null default 1,
  unique(floor_id, code)
);
create table public.products (
  id text primary key, store_id text not null references public.stores(id) on delete restrict,
  name_zh text not null, name_ja text not null default '', brand text not null default '', spec text not null default '',
  jan text not null default '' check(jan = '' or jan ~ '^[0-9]{8}$|^[0-9]{13}$'),
  aliases text[] not null default '{}', category text not null default '', image_url text,
  color text not null default '#d7e2df', updated_at timestamptz not null default now()
);
create unique index products_store_jan on public.products(store_id, jan) where jan <> '';
create table public.product_locations (
  id text primary key, product_id text not null references public.products(id) on delete restrict,
  shelf_id text not null references public.shelves(id) on delete restrict,
  face text not null check(face in ('A','B')), level integer not null check(level between 1 and 20),
  section text not null default '中间', active boolean not null default true,
  last_verified_at timestamptz not null, version integer not null default 1,
  unique(product_id, shelf_id, face, level, section)
);
create table public.floor_access_points (
  id text primary key, floor_id text not null references public.floors(id) on delete restrict,
  group_code text not null, kind text not null check(kind in ('stairs','elevator','escalator')), label text not null,
  x real not null check(x >= 0), z real not null check(z >= 0), connects_to text[] not null default '{}',
  direction text not null default 'both' check(direction in ('both','up','down')),
  available boolean not null default true, accessible boolean
);
create index shelves_floor on public.shelves(floor_id);
create index floors_store on public.floors(store_id);
create index products_store on public.products(store_id);
create index locations_shelf on public.product_locations(shelf_id);
create index access_floor on public.floor_access_points(floor_id);

create function public.validate_location() returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_store text; product_store text; shelf_levels integer;
begin
  select f.store_id, s.levels into target_store, shelf_levels from public.shelves s join public.floors f on f.id=s.floor_id where s.id=new.shelf_id;
  select store_id into product_store from public.products where id=new.product_id;
  if target_store is null or product_store is null or target_store <> product_store then raise exception 'Product and shelf must belong to the same store'; end if;
  if new.level > shelf_levels then raise exception 'Level exceeds shelf capacity'; end if;
  if new.last_verified_at > now() + interval '5 minutes' then raise exception 'Verification cannot be in the future'; end if;
  if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
  return new;
end; $$;
create trigger check_location before insert or update on public.product_locations for each row execute function public.validate_location();

create function public.validate_shelf() returns trigger language plpgsql security invoker set search_path = '' as $$
declare fw real; fd real; extent_x real; extent_z real;
begin
  select width, depth into fw, fd from public.floors where id=new.floor_id;
  extent_x := (abs(cos(radians(new.rotation)))*new.width + abs(sin(radians(new.rotation)))*new.depth)/2;
  extent_z := (abs(sin(radians(new.rotation)))*new.width + abs(cos(radians(new.rotation)))*new.depth)/2;
  if fw is null or new.x-extent_x < 0 or new.z-extent_z < 0 or new.x+extent_x > fw or new.z+extent_z > fd then raise exception 'Shelf is outside floor bounds'; end if;
  if tg_op='UPDATE' then
    if new.floor_id <> old.floor_id and exists(select 1 from public.product_locations where shelf_id=old.id) then raise exception 'Cannot move an occupied shelf to another floor'; end if;
    if exists(select 1 from public.product_locations where shelf_id=old.id and level>new.levels) then raise exception 'Existing locations exceed new shelf capacity'; end if;
    new.version := old.version + 1;
  end if;
  return new;
end; $$;
create trigger check_shelf before insert or update on public.shelves for each row execute function public.validate_shelf();

alter table public.stores enable row level security;
alter table public.floors enable row level security;
alter table public.shelves enable row level security;
alter table public.products enable row level security;
alter table public.product_locations enable row level security;
alter table public.floor_access_points enable row level security;

grant select on public.stores, public.floors, public.shelves, public.products, public.product_locations, public.floor_access_points to anon;
grant select, insert, update, delete on public.stores, public.floors, public.shelves, public.products, public.product_locations, public.floor_access_points to authenticated;

create policy store_public_read on public.stores for select to anon, authenticated using(published);
create policy store_admin on public.stores for all to authenticated using(public.is_store_admin(id)) with check(public.is_store_admin(id));
create policy floor_public_read on public.floors for select to anon, authenticated using(published and exists(select 1 from public.stores s where s.id=store_id and s.published));
create policy floor_admin on public.floors for all to authenticated using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy shelf_public_read on public.shelves for select to anon, authenticated using(exists(select 1 from public.floors f where f.id=floor_id and f.published and exists(select 1 from public.stores s where s.id=f.store_id and s.published)));
create policy shelf_admin on public.shelves for all to authenticated using(exists(select 1 from public.floors f where f.id=floor_id and public.is_store_admin(f.store_id))) with check(exists(select 1 from public.floors f where f.id=floor_id and public.is_store_admin(f.store_id)));
create policy product_public_read on public.products for select to anon, authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.published));
create policy product_admin on public.products for all to authenticated using(public.is_store_admin(store_id)) with check(public.is_store_admin(store_id));
create policy location_public_read on public.product_locations for select to anon, authenticated using(active and exists(select 1 from public.shelves s join public.floors f on f.id=s.floor_id join public.stores st on st.id=f.store_id where s.id=shelf_id and f.published and st.published));
create policy location_admin on public.product_locations for all to authenticated using(exists(select 1 from public.shelves s join public.floors f on f.id=s.floor_id where s.id=shelf_id and public.is_store_admin(f.store_id))) with check(exists(select 1 from public.shelves s join public.floors f on f.id=s.floor_id where s.id=shelf_id and public.is_store_admin(f.store_id)));
create policy access_public_read on public.floor_access_points for select to anon, authenticated using(exists(select 1 from public.floors f join public.stores s on s.id=f.store_id where f.id=floor_id and f.published and s.published));
create policy access_admin on public.floor_access_points for all to authenticated using(exists(select 1 from public.floors f where f.id=floor_id and public.is_store_admin(f.store_id))) with check(exists(select 1 from public.floors f where f.id=floor_id and public.is_store_admin(f.store_id)));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('product-images','product-images',true,2097152,array['image/jpeg','image/png','image/webp']);
create policy image_admin_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_store_admin((storage.foldername(name))[1]));
create policy image_admin_read on storage.objects for select to authenticated using(bucket_id='product-images' and public.is_store_admin((storage.foldername(name))[1]));
create policy image_admin_update on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_store_admin((storage.foldername(name))[1])) with check(bucket_id='product-images' and public.is_store_admin((storage.foldername(name))[1]));
create policy image_admin_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_store_admin((storage.foldername(name))[1]));

create function public.validate_access_point() returns trigger language plpgsql security invoker set search_path = '' as $$
declare origin public.floors; dest public.floors; destination text;
begin
  select * into origin from public.floors where id=new.floor_id;
  if origin.id is null or new.x > origin.width or new.z > origin.depth then raise exception 'Invalid access point coordinates'; end if;
  foreach destination in array new.connects_to loop
    select * into dest from public.floors where id=destination;
    if dest.id is null or dest.store_id <> origin.store_id or dest.id=origin.id then raise exception 'Invalid connected floor'; end if;
    if new.direction='up' and dest.sort_order <= origin.sort_order or new.direction='down' and dest.sort_order >= origin.sort_order then raise exception 'Connected floor conflicts with direction'; end if;
  end loop;
  return new;
end; $$;
create trigger check_access before insert or update on public.floor_access_points for each row execute function public.validate_access_point();

commit;
