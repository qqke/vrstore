-- All verification changes roll back. Uses the dedicated demo seed.
begin;
do $$ declare original_version integer;
begin
  select version into original_version from public.shelves where id='1f-s2';
  begin
    perform public.update_layout(jsonb_build_array(
      jsonb_build_object('id','1f-s2','version',original_version,'x',8,'z',5,'width',2.1,'depth',3,'rotation',0),
      jsonb_build_object('id','missing','version',1,'x',5,'z',5,'width',2,'depth',2,'rotation',0)));
    raise exception 'Invalid layout accepted';
  exception when raise_exception then if sqlerrm='Invalid layout accepted' then raise; end if;
  end;
  if (select version from public.shelves where id='1f-s2')<>original_version then raise exception 'Partial layout persisted'; end if;
  begin update public.floors set width='NaN'::real where id='1f'; raise exception 'Nonfinite layout accepted'; exception when check_violation then null; end;
  begin delete from public.floors where id='2f'; raise exception 'Connected floor deleted'; exception when raise_exception then if sqlerrm='Connected floor deleted' then raise; end if; end;
end; $$;
select 'Atomic layout, finite coordinates and protected floor links passed' as result;
rollback;
