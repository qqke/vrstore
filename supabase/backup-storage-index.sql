-- Read through a trusted SQL connection. Public Storage listing is not a complete inventory.
select jsonb_build_object(
  'capturedAt',now(),
  'bucket','product-images',
  'objects',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'size',(metadata->>'size')::bigint)),'[]'::jsonb)
             from storage.objects where bucket_id='product-images')
) as inventory;
