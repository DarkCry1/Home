const assert=require('node:assert/strict');const R=require('../receipt-parser.js');
const cases=[
 ['standard with totals and payment',`ICA KVANTUM\nStorgatan 12\nTel 0123-45678\n2026-10-21 18:40\nKvitto 12345\nMJÖLK 1L 16,90\nKaffe 2 st x 49,90 99,80\nPant 2,00\nRabatt kaffe -10,00\nSUMMA 108,70\nVISA 108,70\nMoms 12% 11,65`,[['MJÖLK 1L',1],['Kaffe',2]]],
 ['quantity on next line',`Pasta 42,00\n3 st x 14,00 42,00\nSaft 30,00\n2 15,00 30,00\nATT BETALA 72,00`,[['Pasta',3],['Saft',2]]],
 ['quantity before item',`2 x Kaffe 99,80\n3* Tomatpuré 39,00\nTOTALT 138,80`,[['Kaffe',2],['Tomatpuré',3]]],
 ['column quantities',`Yoghurt 1L 2 24,90 49,80\nGlass 3 15,00 45,00\nSumma 94,80`,[['Yoghurt 1L',2],['Glass',3]]],
 ['weighted goods',`BANANER 13,70\n0,550 kg x 24,90 13,70\nTomater 0,350 kg x 39,90 13,97\nSUMMA 27,67`,[['BANANER',1],['Tomater',1]]],
 ['split labels and totals',`HALLONSAFT\n32,90\nFALUKORV\n2 st x 29,90 59,80\nSumma 92,70`,[['HALLONSAFT',1],['FALUKORV',2]]],
 ['packs are not quantities',`ÄGG 12-PACK 39,90\nTomater 500g 24,90\nPasta 2kg 32,90\nTotal 97,70`,[['ÄGG 12-PACK',1],['Tomater 500g',1],['Pasta 2kg',1]]],
 ['money formats and VAT markers',`Kaffe 49.90 A\nSaft 19:90 *\nBönor 12,90 B\nS:a 82,70\nKONTANT 100,00`,[['Kaffe',1],['Saft',1],['Bönor',1]]],
 ['discounts are excluded',`Mjölk 18,90\nRabatt 3,00\nKUPONG 5,00\nDu sparade 8,00\nPant 1,00\nPapperskasse 5,00\nRetur -8,00\nSumma 11,90`,[['Mjölk',1]]],
 ['price OCR cannot create negative stock',`Kaffe -49,90\nSaft 20,00\nTOTALT -29,90`,[['Saft',1]]],
 ['no currency means manual review needed',`ICA\nMJÖLK\nKAFFE\nTack för ditt köp`,[]]
];
for(const [title,text,expected]of cases){const result=R.parse(text);assert.deepEqual(result.rows.map(r=>[r.name,r.qty]),expected,title)}
assert.match(R.parse('Bananer 12,90\n0,500 kg x 25,80 12,90').rows[0].note,/kontrolleras/);
const inventory=[{id:'existing',name:'Kaffe',qty:3,code:'123',cat:'Skafferi',shop:true}];
const rows=[{name:'Kaffe',qty:2,cat:'Skafferi',selected:true,match:'existing'},{name:'Mjölk',qty:1,cat:'Kylskåp',selected:true,match:''},{name:'MJÖLK',qty:2,cat:'Kylskåp',selected:true,match:''},{name:'Pant',qty:2,cat:'Övrigt',selected:false,match:''}];
const before=JSON.stringify(inventory);let seq=0;const plan=R.plan(inventory,rows,()=>String(++seq));assert.equal(JSON.stringify(inventory),before);assert.equal(plan.items.length,2);assert.equal(plan.items[0].qty,5);assert.equal(plan.items[0].code,'123');assert.equal(plan.items[0].shop,true);assert.equal(plan.items[1].qty,3);assert.equal(plan.units,5);
assert.throws(()=>R.plan(inventory,[{...rows[0],qty:1.5}],()=>''),/Kontrollera/);
assert.throws(()=>R.plan(inventory,[{...rows[0],match:'gone'}],()=>''),/inte längre/);
assert.throws(()=>R.plan(inventory,[{...rows[0],qty:9999}],()=>''),/överskrids/);
assert.throws(()=>R.plan(inventory,[],()=>''),/minst en/);
assert.equal(JSON.stringify(inventory),before,'failed plans preserve original inventory');
const lines=R.pdfLines([{str:'16,90',transform:[1,0,0,1,200,400],height:10},{str:'Mjölk',transform:[1,0,0,1,10,400],height:10},{str:'SUMMA',transform:[1,0,0,1,10,380],height:10},{str:'16,90',transform:[1,0,0,1,200,380],height:10}]);assert.equal(lines,'Mjölk 16,90\nSUMMA 16,90');assert.equal(R.parse(lines).rows.length,1);
assert.equal(R.category('Glass vanilj'),'Frys');assert.equal(R.category('Mjölk 1L'),'Kylskåp');assert.equal(R.category('Diskmedel'),'Övrigt');
console.log('PASS: '+cases.length+' receipt layouts; quantities, weights, totals, discounts, PDF line order, merging, validation, stock limits, and original data preservation');
