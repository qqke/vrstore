-- The dashboard's automatic RLS event trigger still works as its owner.
-- API users must never call the generated SECURITY DEFINER function.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
