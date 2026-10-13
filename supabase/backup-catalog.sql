-- Run through a trusted SQL connection; save results privately, never to the public repo.
-- This is an application-table snapshot, not an Auth or Storage file backup.
select jsonb_build_object(
  'stores',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.stores t),
  'floors',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.floors t),
  'shelves',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.shelves t),
  'products',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.products t),
  'product_locations',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.product_locations t),
  'floor_access_points',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.floor_access_points t),
  'store_admins',(select coalesce(jsonb_agg(t),'[]'::jsonb) from public.store_admins t)
) as snapshot;
