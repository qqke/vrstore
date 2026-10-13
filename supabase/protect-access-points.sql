begin;
create function public.protect_access_reference() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op='DELETE' or new.group_code<>old.group_code or new.floor_id<>old.floor_id) and exists(
    select 1 from public.floor_access_points p join public.floors f on f.id=p.floor_id join public.floors origin on origin.id=old.floor_id
    where p.id<>old.id and f.store_id=origin.store_id and p.group_code=old.group_code and old.floor_id=any(p.connects_to)) then raise exception 'Access point is referenced by other floors; unlink or disable it first'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
create trigger access_reference before delete or update on public.floor_access_points for each row execute function public.protect_access_reference();
commit;
