import { expect, it } from 'vitest';
import { importCSV, parseCSV, parseField } from './admin-fields';
import { readFileSync } from 'node:fs';

it('parses quoted commas, multiline fields, escaped quotes and BOM', () => {
  expect(parseCSV('\uFEFFid,name\r\np1,"名字,规格"\r\np2,"两行\n内容"\np3,"say ""hi"""')).toEqual([['id','name'],['p1','名字,规格'],['p2','两行\n内容'],['p3','say "hi"']]);
  expect(() => parseCSV('id\n"unfinished')).toThrow();
});
it('preserves barcodes and rejects bad columns, duplicates and values', () => {
  expect(importCSV('products','id,jan,aliases\np1,0490000000001,别名|brand')[0]).toEqual({ id:'p1',jan:'0490000000001',aliases:['别名','brand'] });
  expect(() => importCSV('products','id,unknown\np1,x')).toThrow();
  expect(() => importCSV('products','id,jan\np1,1\np1,2')).toThrow();
  expect(() => parseField({key:'width',label:'宽度',type:'number'},'NaN')).toThrow();
  expect(() => parseField({key:'published',label:'发布',type:'boolean'},'yes')).toThrow();
  expect(() => parseField({key:'last_verified_at',label:'日期',type:'datetime'},'2026-10-13')).toThrow();
});

it('accepts every generated virtual-pilot import without losing its types', () => {
  for (const [table, count] of [['floors',3],['shelves',24],['products',30],['product_locations',31],['floor_access_points',6]] as const) {
    const rows = importCSV(table, readFileSync(new URL(`../pilot/demo-imports/${table}.csv`, import.meta.url), 'utf8'));
    expect(rows).toHaveLength(count);
    if (table === 'products') { expect(rows[0].jan).toBe('0490000000001'); expect(rows[0].active).toBe(true); }
    if (table === 'floor_access_points') expect(rows[0].connects_to).toEqual(['1f','2f']);
  }
});
