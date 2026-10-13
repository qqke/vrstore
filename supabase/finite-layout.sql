begin;
alter table public.floors add constraint finite_floor_bounds check(width::text not in ('NaN','Infinity','-Infinity') and depth::text not in ('NaN','Infinity','-Infinity'));
alter table public.shelves add constraint finite_shelf_geometry check(x::text not in ('NaN','Infinity','-Infinity') and z::text not in ('NaN','Infinity','-Infinity') and width::text not in ('NaN','Infinity','-Infinity') and depth::text not in ('NaN','Infinity','-Infinity') and rotation::text not in ('NaN','Infinity','-Infinity'));
alter table public.floor_access_points add constraint finite_access_coordinates check(x::text not in ('NaN','Infinity','-Infinity') and z::text not in ('NaN','Infinity','-Infinity'));
alter table public.stores add constraint store_name_nonempty check(length(trim(name))>0);
alter table public.floors add constraint floor_name_nonempty check(length(trim(name))>0);
alter table public.shelves add constraint shelf_code_nonempty check(length(trim(code))>0);
alter table public.products add constraint product_name_nonempty check(length(trim(name_zh))>0);
commit;
