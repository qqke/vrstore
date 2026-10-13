import { expect, it } from 'vitest';
import { importCSV, parseCSV, parseField } from './admin-fields';

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
