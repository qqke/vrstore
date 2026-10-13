begin;
create function public.protect_floor_links() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='DELETE' and exists(select 1 from public.floor_access_points where old.id=any(connects_to)) then raise exception 'Floor is referenced by access points'; end if;
  if tg_op='UPDATE' and new.sort_order<>old.sort_order and exists(
    select 1 from public.floor_access_points p cross join lateral unnest(p.connects_to) destination join public.floors origin on origin.id=p.floor_id join public.floors target on target.id=destination
    where (origin.id=old.id or target.id=old.id) and
      (p.direction='up' and (case when target.id=old.id then new.sort_order else target.sort_order end) <= (case when origin.id=old.id then new.sort_order else origin.sort_order end)
      or p.direction='down' and (case when target.id=old.id then new.sort_order else target.sort_order end) >= (case when origin.id=old.id then new.sort_order else origin.sort_order end))) then raise exception 'Floor order conflicts with existing access direction'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
create trigger floor_links before delete or update on public.floors for each row execute function public.protect_floor_links();
commit;
