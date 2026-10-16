-- Reversible test on the dedicated demo data; no permanent changes.
begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','admin-test@example.invalid');
insert into public.store_admins(user_id,store_id) values ('00000000-0000-4000-8000-000000000001','demo');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
update public.products set active=false where id='p1';
do $$ begin
  if not exists(select 1 from public.products where id='p1' and not active) then raise exception 'Admin cannot maintain inactive product'; end if;
  if not exists(select 1 from public.product_locations where product_id='p1') then raise exception 'Inactive product lost its locations'; end if;
  begin delete from public.products where id='p1'; raise exception 'Occupied product deletion allowed'; exception when foreign_key_violation or restrict_violation then null; end;
end; $$;
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.products where id='p1') then raise exception 'Inactive product exposed'; end if;
  if exists(select 1 from public.product_locations where product_id='p1') then raise exception 'Inactive product locations exposed'; end if;
end; $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
update public.stores set published=false where id='demo';
update public.products set active=true where id='p1';
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.stores where id='demo') or exists(select 1 from public.floors where store_id='demo') or exists(select 1 from public.products where store_id='demo') then raise exception 'Unpublished store still public'; end if;
end; $$;
reset role;
set local role authenticated;
update public.stores set published=true where id='demo';
reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.products where id='p1') or not exists(select 1 from public.product_locations where product_id='p1') then raise exception 'Republished catalog did not return'; end if;
end; $$;
reset role;
rollback;
