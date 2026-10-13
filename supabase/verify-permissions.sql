-- Reversible verification in a dedicated project. All test records and changes roll back.
begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000001','admin-test@example.invalid'),('00000000-0000-4000-8000-000000000002','user-test@example.invalid');
insert into public.store_admins(user_id,store_id) values ('00000000-0000-4000-8000-000000000001','demo');
insert into public.stores(id,name,published) values ('test-private','private store',false);
insert into public.floors(id,store_id,name,sort_order,width,depth,published) values ('test-private-floor','test-private','1F',0,20,20,false);
insert into public.shelves(id,floor_id,code,x,z,width,depth) values ('test-private-shelf','test-private-floor','A01',5,5,2,2);

set local role anon;
do $$ begin
  if (select count(*) from public.floors)<>3 then raise exception 'Anonymous floor visibility failed'; end if;
  if exists(select 1 from public.stores where id='test-private') then raise exception 'Private store leaked'; end if;
  begin insert into public.products(id,store_id,name_zh) values('test-anon','demo','test'); raise exception 'Anonymous write allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if public.is_store_admin('demo') then raise exception 'Ordinary user became admin'; end if;
  begin update public.stores set name='invalid' where id='demo'; if found then raise exception 'Ordinary user updated store'; end if; exception when insufficient_privilege then null; end;
end; $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare original_version integer; affected integer;
begin
  if not public.is_store_admin('demo') then raise exception 'Authorized admin rejected'; end if;
  select version into original_version from public.shelves where id='1f-s1';
  update public.shelves set category=category where id='1f-s1' and version=original_version;
  if not found then raise exception 'Authorized update rejected'; end if;
  update public.shelves set category='conflict' where id='1f-s1' and version=original_version;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Version conflict was ignored'; end if;
  if exists(select 1 from public.floors where id='test-private-floor') then raise exception 'Cross-store visibility leaked'; end if;
  begin insert into public.products(id,store_id,name_zh) values('test-other','test-private','test'); raise exception 'Cross-store insert allowed'; exception when insufficient_privilege then null; end;
  begin update public.store_admins set store_id='test-private' where user_id=auth.uid(); raise exception 'Self privilege escalation allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.product_locations(id,product_id,shelf_id,face,level,last_verified_at) values('test-level','p1','1f-s1','A',20,now()); raise exception 'Invalid level accepted'; exception when raise_exception then if sqlerrm='Invalid level accepted' then raise; end if; end;
  perform public.import_records('products','[{"id":"test-import-1","store_id":"demo","name_zh":"test"}]');
  if not exists(select 1 from public.products where id='test-import-1') then raise exception 'Atomic import failed'; end if;
  begin perform public.import_records('products','[{"id":"test-import-2","store_id":"demo","name_zh":"test"},{"id":"test-import-1","store_id":"demo","name_zh":"duplicate"}]'); raise exception 'Duplicate import accepted'; exception when unique_violation then null; end;
  if exists(select 1 from public.products where id='test-import-2') then raise exception 'Failed import left partial records'; end if;
end; $$;
reset role;

delete from public.store_admins where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if public.is_store_admin('demo') then raise exception 'Revoked administrator retained access'; end if;
  update public.shelves set category='revoked' where id='1f-s1';
  if found then raise exception 'Revoked administrator could write'; end if;
end; $$;
reset role;
rollback;
