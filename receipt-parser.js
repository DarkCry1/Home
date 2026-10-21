/* Receipt parsing and import planning. No network requests or persistent writes. */
(function(root){
'use strict';
const categories=['Skafferi','Kylskåp','Frys','Övrigt'];
const money='-?\\d+(?:[ .]\\d{3})?[.,:]\\d{2}';
const priceEnd=new RegExp('\\s+('+money+')\\s*(?:kr|SEK)?\\s*[*A-D]?\\s*$','i');
const summary=/^(?:att\s+betala|summa(?:\s+(?:sek|kr|inkl|att))?|s\s*[:.]\s*a\b|total(?:t|belopp)?\b|belopp\b|varav\s+moms|moms\s*%|momsredovisning)/i;
const nonGoods=/^(?:pant(?:\b|[0-9])|retur(?:pant)?\b|rabatt\b|stammis(?:rabatt|pris)?\b|bonus\b|kupong\b|erbjudande\b|medlemspris\b|kampanj\b|du\s+(?:sparade|har\s+sparat)|avrundning\b|öresavrundning\b|bärkasse\b|plastkasse\b|papperskasse\b|delsumma\b)/i;
const metadata=/^(?:välkommen|tack\b|öppet\b|öppettider|org(?:anisations)?\s*(?:nr|nummer)|momsreg|telefon|tel\b|www\.|https?:|kassa\b|kassör|kvitto\b|kvittonr|kontroll(?:kod|enhet)|terminal|transaktion|datum\b|tid\b|köp(?:datum|tid)?\s*[:#]|kund\s*(?:nr|nummer)|medlem(?:snummer)?\b|kort(?:köp|nummer|innehavare)?\b|visa\b|mastercard\b|swish\b|kontant\b|betalt\b|erhållet\b|växel\b|betal(?:ning|medel)|godkänd|auktor|referens\b|ref\b|a[iu]d\b|tvr\b|ts[iy]\b|appl\b|batch\b|sek\b)/i;
const normalize=s=>String(s).normalize('NFKC').toLocaleLowerCase('sv').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function category(name){
 if(/fryst|djupfryst|glass\b|frys/i.test(name))return 'Frys';
 if(/mjölk|mjolk|yoghurt|fil\b|grädde|gradde|smör|smor|ost\b|kvarg|cr[eè]me\s*fra[iî]che|kyckling|lax\b|färs|fars\b|korv|skinka|tofu/i.test(name))return 'Kylskåp';
 if(/schampo|tvål|tval|diskmedel|tvätt|tvatt|papper|batteri|tandkräm|tandkram/i.test(name))return 'Övrigt';
 return 'Skafferi';
}
function cleanName(s){return s.replace(/^\s*[*•#]+\s*/,'').replace(/\s+/g,' ').trim().slice(0,80)}
function validName(s){return /\p{L}/u.test(s)&&s.length>=2&&!metadata.test(s)&&!nonGoods.test(s)&&!summary.test(s)&&!/^\d{4}[-/.]\d{2}[-/.]\d{2}/.test(s)}
function parse(text){
 const lines=String(text).normalize('NFKC').replace(/[\u200b-\u200d]/g,'').replace(/\u00a0/g,' ').split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
 const rows=[];let pending='',last=null,ended=false,skipped=0;
 function add(name,qty=1,note=''){
  name=cleanName(name);if(!validName(name)){skipped++;return null}
  if(rows.length>=200)throw Error('Kvittot har fler än 200 varurader. Dela upp kvittot innan du importerar.');
  const row={name,qty,cat:category(name),note,selected:true,match:''};rows.push(row);last=row;pending='';return row;
 }
 for(const line of lines){
  if(summary.test(line)){ended=true;pending='';continue}
  if(ended||metadata.test(line)||nonGoods.test(line)||/^[-=*_.\s]+$/.test(line)){skipped++;pending='';last=null;continue}
  // A quantity/weight breakdown may follow a product whose total is on its own row.
  const detailLine=line.replace(/^(\d+(?:[.,]\d+)?)(?=st\b|kg\b|hg\b|g\b|l\b|[x×*])/i,'$1 ');
  const detail=detailLine.match(/^(\d+(?:[.,]\d+)?)\s+(st|kg|g|hg|l)?\s*(?:x|×|\*|à|a\s+)?\s*(-?\d+[.,:]\d{2})\s*(?:kr\s*\/\s*(?:st|kg|hg|l))?(?:\s+-?\d+[.,:]\d{2})?\s*[*A-D]?$/i);
  if(detail){
   const q=Number(detail[1].replace(',','.')),unit=(detail[2]||'st').toLowerCase();
   const weighted=unit!=='st'||!Number.isInteger(q);
   const note=weighted?'Vikt-/volymvara ('+detail[1]+' '+unit+'). Antal förpackningar behöver kontrolleras.':'';
   if(pending){add(pending,weighted?1:q,note)}
   else if(last){last.qty=weighted?1:q;last.note=note}
   else skipped++;
   pending='';continue;
  }
  const priced=line.match(priceEnd);
  if(priced){
   const value=Number(priced[1].replace(/ /g,'').replace(/\.(?=\d{3}[.,])/g,'').replace(':','.').replace(',','.'));
   if(value<0){skipped++;pending='';last=null;continue}
   let name=line.slice(0,priced.index).trim(),qty=1,note='';
   // Swedish receipts often have name, number, unit price and line total columns.
   const columns=name.match(new RegExp('^(.*?)\\s+(\\d{1,3})\\s+('+money+')$'));
   if(columns){name=columns[1];qty=Number(columns[2])}
   const weight=name.match(/^(.*?)\s+(\d+[.,]\d+)\s*(kg|hg|g|l)\s*(?:(?:x|×|\*|à)\s*)?(?:\d+[.,:]\d{2}\s*(?:kr\/?(?:kg|hg|g|l))?)?$/i);
   if(weight){name=weight[1];note='Vikt-/volymvara ('+weight[2]+' '+weight[3]+'). Kontrollera antal förpackningar.'}
   const suffix=name.match(/^(.*?)\s+(\d{1,3})\s*(?:st\b\s*(?:(?:x|×|\*)\s*\d+[.,:]\d{2})?|(?:x|×|\*|à)\s*\d+[.,:]\d{2})$/i);
   if(suffix){name=suffix[1];qty=Number(suffix[2])}
   const prefix=name.match(/^(\d{1,3})\s*(?:st\b|x\s|×|\*)\s*(.+)$/i);
   if(prefix){qty=Number(prefix[1]);name=prefix[2]}
   if(!name&&pending)name=pending;
   add(name,qty,note);continue;
  }
  // A price-only line belongs to the immediately preceding product label.
  if(new RegExp('^'+money+'\\s*[*A-D]?$').test(line)&&pending){
   if(!line.startsWith('-'))add(pending);else pending='';continue;
  }
  if(validName(line)&&!/^ICA\s+(?:MAXI|KVANTUM|SUPERMARKET|NÄRA)\b/i.test(line)&&!/\b(?:gatan|vägen)\s+\d/i.test(line)&&!/^\d{3}\s?\d{2}\b/.test(line))pending=cleanName(line);
  else{pending='';skipped++}
 }
 return {rows:rows.filter(r=>Number.isInteger(r.qty)&&r.qty>0&&r.qty<=9999),skipped};
}
function plan(inventory,rows,idFactory){
 const chosen=rows.filter(r=>r.selected);
 if(!chosen.length)throw Error('Markera minst en vara att importera.');
 if(chosen.length>200)throw Error('Importera högst 200 varurader åt gången.');
 const next=inventory.map(i=>({...i})),newByName=new Map(),deltas=[];
 for(const row of chosen){
  const name=String(row.name).trim();
  if(!name||name.length>80||!Number.isInteger(row.qty)||row.qty<1||row.qty>9999||!categories.includes(row.cat))throw Error('Kontrollera varunamn, förvaring och antal (1–9999) för alla markerade rader.');
  let item;
  if(row.match){item=next.find(i=>i.id===row.match);if(!item)throw Error('En vald vara finns inte längre i lagret. Välj matchning på nytt.');}
  else item=newByName.get(normalize(name)+'|'+row.cat);
  if(!item){item={id:idFactory(),name,code:'',qty:0,cat:row.cat,shop:false};next.push(item);newByName.set(normalize(name)+'|'+row.cat,item)}
  if(!Number.isInteger(item.qty)||item.qty+row.qty>9999)throw Error('Maxantalet 9999 överskrids för '+item.name+'. Justera importen.');
  item.qty+=row.qty;deltas.push({id:item.id,qty:row.qty});
 }
 return {items:next,deltas,rows:chosen.length,units:chosen.reduce((n,r)=>n+r.qty,0)};
}
function pdfLines(items){
 const groups=[];
 for(const item of items){
  if(!item.str?.trim()||!item.transform)continue;
  const x=item.transform[4],y=item.transform[5];
  let group=groups.find(g=>Math.abs(g.y-y)<=Math.max(2,Math.min(4,(item.height||10)*0.3)));
  if(!group){group={y,parts:[]};groups.push(group)}
  group.parts.push({x,text:item.str});
 }
 return groups.sort((a,b)=>b.y-a.y).map(g=>g.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ')).join('\n');
}
const api={parse,plan,normalize,category,pdfLines,categories};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReceiptTools=api;
})(globalThis);
