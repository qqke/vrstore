begin;
alter table public.products add column active boolean not null default true;
drop policy product_public_read on public.products;
create policy product_public_read on public.products for select to anon, authenticated
using(active and exists(select 1 from public.stores s where s.id=store_id and s.published));
drop policy location_public_read on public.product_locations;
create policy location_public_read on public.product_locations for select to anon, authenticated
using(active and exists(
  select 1 from public.shelves s
  join public.floors f on f.id=s.floor_id
  join public.stores st on st.id=f.store_id
  join public.products p on p.id=product_id
  where s.id=shelf_id and f.published and st.published and p.active
));
commit;
