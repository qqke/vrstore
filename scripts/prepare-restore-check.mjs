import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync(new URL('../.backups/catalog.json', import.meta.url), 'utf8')).tables;
const names = ['stores','floors','shelves','products','product_locations','floor_access_points','store_admins'];
let sql = 'begin;\n';
for (const name of names) {
  assert(Array.isArray(snapshot[name]), `Missing table ${name}`);
  const json = JSON.stringify(snapshot[name]).replaceAll("'", "''");
  sql += `create temporary table restore_${name} (like public.${name} including all) on commit drop;\n`;
  sql += `insert into restore_${name} select * from jsonb_populate_recordset(null::public.${name}, '${json}'::jsonb);\n`;
  sql += `do $$ begin if (select count(*) from restore_${name})<>${snapshot[name].length} then raise exception 'Restore count mismatch: ${name}'; end if; end; $$;\n`;
}
sql += `do $$ begin
  if exists(select 1 from restore_floors f left join restore_stores s on s.id=f.store_id where s.id is null) then raise exception 'Restored floor has no store'; end if;
  if exists(select 1 from restore_shelves s left join restore_floors f on f.id=s.floor_id where f.id is null) then raise exception 'Restored shelf has no floor'; end if;
  if exists(select 1 from restore_product_locations l left join restore_products p on p.id=l.product_id left join restore_shelves s on s.id=l.shelf_id where p.id is null or s.id is null or l.level>s.levels) then raise exception 'Restored location invalid'; end if;
  if exists(select 1 from restore_floor_access_points a cross join lateral unnest(a.connects_to) target left join restore_floors f on f.id=target where f.id is null) then raise exception 'Restored connection invalid'; end if;
end; $$;
select 'Restored catalog counts and relationships verified in isolated temporary tables' as result;
rollback;\n`;
writeFileSync(new URL('../.backups/restore-check.sql', import.meta.url), sql);
console.log('Prepared isolated transactional restore verification; production rows remain untouched.');
