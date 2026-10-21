/* Receipt import: image OCR, PDF text/OCR, review, and an explicit inventory commit. */
'use strict';
const receiptHistoryKey='hemma-receipts-v1';
let receiptHistory=[];
try{const saved=JSON.parse(localStorage.getItem(receiptHistoryKey)||'[]');if(Array.isArray(saved))receiptHistory=saved}catch{}
let receiptFile=null,receiptPreviewUrl='',receiptRotation=0,receiptRows=[],receiptSourceHash='',receiptFileHash='',receiptJob=null,receiptWorkerLoad=null,receiptPdfLoad=null;
let receiptSession=0,receiptCommitting=false;
const receiptDeps={
 tesseract:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
 worker:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
 core:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
 pdf:'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
 pdfWorker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'
};
function receiptError(message){$('#r-error').textContent=message;$('#r-error').hidden=!message}
function receiptStage(stage){for(const name of ['input','busy','review'])$('#r-'+name).hidden=name!==stage}
function releaseReceiptPreview(){if(receiptPreviewUrl)URL.revokeObjectURL(receiptPreviewUrl);receiptPreviewUrl='';$('#r-preview').removeAttribute('src');$('#r-image').hidden=true}
function cancelReceiptJob(){
 const job=receiptJob;if(!job)return;
 job.cancelled=true;job.cancel?.();
 job.worker?.terminate().catch(()=>{});
 job.pdfTask?.destroy().catch(()=>{});
 receiptJob=null;
}
function openReceipt(){
 receiptSession++;
 cancelReceiptJob();releaseReceiptPreview();receiptFile=null;receiptRows=[];receiptSourceHash=receiptFileHash='';receiptRotation=0;
 $('#r-text').value=$('#r-raw').value=$('#r-upload').value=$('#r-camera-input').value='';
 $('#r-filename').textContent='';$('#r-read').disabled=true;
 receiptStage('input');receiptError('');$('#receipt').showModal();
}
function selectReceiptFile(file){
 if(!file)return;
 if(file.size>20*1024*1024){receiptError('Filen är för stor. Välj en fil som är högst 20 MB.');return}
 const supported=/^(image\/|application\/pdf|text\/plain)/.test(file.type)||/\.(?:pdf|png|jpe?g|webp|heic|heif|txt)$/i.test(file.name);
 if(!supported){receiptError('Välj en bild, PDF eller textfil.');return}
 releaseReceiptPreview();receiptFile=file;receiptRotation=0;$('#r-text').value='';
 $('#r-filename').textContent=file.name||'Fotograferat kvitto';$('#r-read').disabled=false;
 $('#r-read').textContent='Läs kvittot';receiptError('');
 if(file.type.startsWith('image/')||/\.(?:png|jpe?g|webp|heic|heif)$/i.test(file.name)){
  receiptPreviewUrl=URL.createObjectURL(file);$('#r-preview').src=receiptPreviewUrl;$('#r-preview').style.transform='';$('#r-image').hidden=false;
 }
}
function receiptWait(promise,job,timeout=120000){
 return new Promise((resolve,reject)=>{
  let finished=false;
  const cancel=()=>done(new DOMException('Avbrutet','AbortError'));
  const timer=setTimeout(()=>done(Error('Avläsningen tog för lång tid. Prova en mindre och tydligare bild, eller klistra in kvittotexten.')),timeout);
  function done(error,result){if(finished)return;finished=true;clearTimeout(timer);if(job.cancel===cancel)job.cancel=null;error?reject(error):resolve(result)}
  job.cancel=cancel;
  Promise.resolve(promise).then(r=>done(null,r),e=>done(e));
  if(job.cancelled)cancel();
 });
}
function receiptCheck(job){if(job.cancelled||receiptJob!==job||!$('#receipt').open)throw new DOMException('Avbrutet','AbortError')}
function receiptProgress(message,percent){$('#r-status').textContent=message;$('#r-progress').value=percent}
function loadReceiptOCR(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(receiptWorkerLoad)return receiptWorkerLoad;
 receiptWorkerLoad=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let finished=false;
  const timer=setTimeout(()=>fail(),20000);
  function fail(){if(finished)return;finished=true;clearTimeout(timer);script.remove();receiptWorkerLoad=null;reject(Error('Textläsaren kunde inte laddas. Kontrollera internetanslutningen eller klistra in kvittotexten.'))}
  script.src=receiptDeps.tesseract;script.crossOrigin='anonymous';
  script.onload=()=>{if(finished)return;if(!window.Tesseract){fail();return}finished=true;clearTimeout(timer);resolve(window.Tesseract)};
  script.onerror=fail;document.head.appendChild(script);
 });
 return receiptWorkerLoad;
}
async function receiptOCR(image,job,label='Läser kvittot'){
 if(!job.worker){
  receiptProgress('Hämtar textläsaren. Första gången kan det ta en stund…',5);
  const ocr=await receiptWait(loadReceiptOCR(),job,25000);receiptCheck(job);
  const pending=ocr.createWorker(['swe','eng'],1,{
   workerPath:receiptDeps.worker,corePath:receiptDeps.core,
   logger:m=>{if(receiptJob===job&&!job.cancelled){if(m.status==='recognizing text')receiptProgress(label+' · '+Math.round((m.progress||0)*100)+' %',30+(m.progress||0)*65);else receiptProgress('Förbereder svensk textläsning…',15)}},
   errorHandler:error=>{job.workerError=error;job.cancel?.()}
  });
  // If loading finishes after cancellation, immediately release the new worker.
  pending.then(w=>{if(job.cancelled)w.terminate().catch(()=>{})},()=>{});
  job.worker=await receiptWait(pending,job);receiptCheck(job);
  await receiptWait(job.worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'}),job);
 }
 const result=await receiptWait(job.worker.recognize(image,{}, {text:true,blocks:false,hocr:false,tsv:false}),job);
 receiptCheck(job);return result.data.text||'';
}
async function receiptCanvas(file,rotation,job){
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await receiptWait(new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Bilden kunde inte öppnas. Prova en JPG/PNG-bild eller en skärmbild.'));image.src=url}),job,20000);
  receiptCheck(job);
  const swapped=rotation%180!==0,w=swapped?image.naturalHeight:image.naturalWidth,h=swapped?image.naturalWidth:image.naturalHeight;
  if(!w||!h)throw Error('Bilden är tom. Välj en annan bild.');
  const scale=Math.min(1600/w,6500/h,Math.sqrt(8000000/(w*h)),Math.max(1,1200/w));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
  context.translate(canvas.width/2,canvas.height/2);context.rotate(rotation*Math.PI/180);
  context.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale);
  // Mild contrast helps thermal receipts while preserving faint characters.
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const gray=Math.max(0,Math.min(255,(pixels.data[i]*.299+pixels.data[i+1]*.587+pixels.data[i+2]*.114-128)*1.15+128));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray}
  context.putImageData(pixels,0,0);return canvas;
 }finally{URL.revokeObjectURL(url)}
}
async function loadReceiptPDF(){
 if(!receiptPdfLoad){
  if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}};
  receiptPdfLoad=import(receiptDeps.pdf).then(lib=>{lib.GlobalWorkerOptions.workerSrc=receiptDeps.pdfWorker;return lib}).catch(error=>{receiptPdfLoad=null;throw Error('PDF-läsaren kunde inte laddas. Kontrollera internetanslutningen eller välj en skärmbild av kvittot.')});
 }
 return receiptPdfLoad;
}
async function receiptPDF(file,job){
 receiptProgress('Öppnar PDF-kvittot…',10);
 const pdfjs=await receiptWait(loadReceiptPDF(),job,30000);receiptCheck(job);
 const buffer=await receiptWait(file.arrayBuffer(),job);receiptCheck(job);
 job.pdfTask=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false});
 const pdf=await receiptWait(job.pdfTask.promise,job,30000);receiptCheck(job);
 if(pdf.numPages>5)throw Error('PDF-filen har fler än 5 sidor. Dela upp den i mindre kvitton och försök igen.');
 const pages=[];
 for(let number=1;number<=pdf.numPages;number++){
  receiptProgress('Läser PDF-sida '+number+' av '+pdf.numPages+'…',10+number/pdf.numPages*60);
  const page=await receiptWait(pdf.getPage(number),job);receiptCheck(job);
  const content=await receiptWait(page.getTextContent(),job);receiptCheck(job);
  let text=ReceiptTools.pdfLines(content.items);
  if(text.replace(/\s/g,'').length<20){
   const base=page.getViewport({scale:1}),scale=Math.min(1600/base.width,6500/base.height,Math.sqrt(8000000/(base.width*base.height)));
   const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   try{await receiptWait(page.render({canvasContext:canvas.getContext('2d'),viewport}).promise,job);text=await receiptOCR(canvas,job,'Läser sida '+number+' av '+pdf.numPages)}finally{canvas.width=canvas.height=1}
  }
  pages.push(text);page.cleanup();
 }
 return pages.join('\n');
}
async function receiptHash(value){
 if(!crypto.subtle)throw Error('Öppna appen via HTTPS för att importera kvitton.');
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function readReceipt(){
 if(receiptJob)return;
 const pasted=$('#r-text').value.trim();if(!pasted&&!receiptFile){receiptError('Välj ett kvitto eller klistra in kvittotext.');return}
 const job={cancelled:false,worker:null,pdfTask:null};receiptJob=job;
 receiptError('');receiptStage('busy');receiptProgress('Förbereder kvittot…',0);
 try{
  let text=pasted;receiptFileHash='';
  if(!pasted){
   receiptFileHash=await receiptWait(receiptFile.arrayBuffer().then(receiptHash),job);receiptCheck(job);
   if(receiptFile.type==='application/pdf'||/\.pdf$/i.test(receiptFile.name))text=await receiptPDF(receiptFile,job);
   else if(receiptFile.type==='text/plain'||/\.txt$/i.test(receiptFile.name))text=await receiptWait(receiptFile.text(),job);
   else{const canvas=await receiptCanvas(receiptFile,receiptRotation,job);try{text=await receiptOCR(canvas,job)}finally{canvas.width=canvas.height=1}}
  }
  receiptCheck(job);if(text.length>100000)throw Error('Kvittotexten är för lång. Dela upp den i mindre kvitton.');$('#r-raw').value=text;
  receiptSourceHash=await receiptWait(receiptHash(text.normalize('NFKC').toLocaleLowerCase('sv').replace(/\s+/g,' ').trim()),job);receiptCheck(job);
  prepareReceiptRows(text);receiptStage('review');
 }catch(error){
  if(!job.cancelled){receiptStage('input');receiptError(job.workerError?'Textläsningen kunde inte slutföras. Prova igen eller klistra in texten.':error.name==='PasswordException'?'PDF-kvittot är lösenordsskyddat. Välj en oskyddad kopia eller en skärmbild.':['InvalidPDFException','MissingPDFException','UnknownErrorException'].includes(error.name)?'PDF-filen kunde inte läsas. Prova en annan kopia eller ta en skärmbild av kvittot.':error.name==='AbortError'?'Textläsningen avbröts. Du kan försöka igen.':error.message||'Kvittot kunde inte läsas. Prova en tydligare bild.')}
 }finally{
  job.cancelled=true;
  try{await job.worker?.terminate()}catch{}
  try{await job.pdfTask?.destroy()}catch{}
  if(receiptJob===job)receiptJob=null;
 }
}
function prepareReceiptRows(text){
 const result=ReceiptTools.parse(text);receiptRows=result.rows;
 for(const row of receiptRows){const matches=items.filter(i=>ReceiptTools.normalize(i.name)===ReceiptTools.normalize(row.name));if(matches.length===1){row.match=matches[0].id;row.cat=matches[0].cat}}
 renderReceiptRows();
 $('#r-parsenote').textContent=receiptRows.length?'Kontrollera namn, antal och förvaring. Välj bort rader som inte ska in i lagret.':'Inga varurader kunde identifieras säkert. Öppna kvittotexten och rätta den, eller lägg till varurader manuellt.';
 receiptError('');
}
function renderReceiptRows(){
 const categories=ReceiptTools.categories.map(c=>`<option value="${c}">${c}</option>`).join('');
 $('#r-rows').innerHTML=receiptRows.map((r,index)=>`<article class="receipt-row" data-row="${index}"><div class="receipt-row-title"><label class="r-checkbox"><input type="checkbox" data-field="selected" ${r.selected?'checked':''} aria-label="Ta med rad ${index+1}">Ta med</label><span>${r.note?'Kontrollera antal':'Varurad '+(index+1)}</span></div><div class="receipt-row-fields"><label>Vara<input data-field="name" value="${esc(r.name)}" maxlength="80" aria-label="Varunamn rad ${index+1}"></label><label>Antal<input type="number" data-field="qty" value="${r.qty}" min="1" max="9999" step="1" inputmode="numeric" aria-label="Antal rad ${index+1}"></label><label>Förvaring<select data-field="cat" ${r.match?'disabled':''}>${categories}</select></label></div>${r.note?`<p class="receipt-row-note">${esc(r.note)}</p>`:''}<label class="receipt-match">Lägg till i<select data-field="match"><option value="">Ny vara i lagret</option>${items.map(i=>`<option value="${esc(i.id)}" ${i.id===r.match?'selected':''}>${esc(i.name)} · ${i.qty} hemma</option>`).join('')}</select></label></article>`).join('');
 document.querySelectorAll('#r-rows [data-row]').forEach(el=>{el.querySelector('[data-field="cat"]').value=receiptRows[Number(el.dataset.row)].cat});
 updateReceiptSummary();
}
function updateReceiptSummary(){
 const selected=receiptRows.filter(r=>r.selected),units=selected.reduce((n,r)=>n+(Number.isInteger(r.qty)?r.qty:0),0);
 const valid=!receiptCommitting&&selected.length>0&&selected.every(r=>r.name.trim()&&Number.isInteger(r.qty)&&r.qty>=1&&r.qty<=9999);
 $('#r-summary').textContent=selected.length+' varurader · '+units+' förpackningar';
 $('#r-import').textContent='Lägg till '+selected.length+' varurader i lagret';$('#r-import').disabled=!valid;
 $('#r-all').checked=receiptRows.length>0&&receiptRows.every(r=>r.selected);
 $('#r-all').indeterminate=selected.length>0&&selected.length<receiptRows.length;
}
async function commitReceipt(){
 if(receiptCommitting)return;receiptCommitting=true;const session=receiptSession;
 const button=$('#r-import');button.disabled=true;receiptError('');
 try{
  // Rehash edited text so duplicate checks use the text that was actually reviewed.
  const sourceHash=await receiptHash($('#r-raw').value.normalize('NFKC').toLocaleLowerCase('sv').replace(/\s+/g,' ').trim());
  if(!$('#receipt').open||session!==receiptSession)return;
  const duplicate=receiptHistory.find(r=>(r.sourceHash&&r.sourceHash===sourceHash)||(receiptFileHash&&r.fileHash===receiptFileHash));
  if(duplicate&&!confirm('Det här kvittot verkar redan vara importerat. Vill du ändå lägga till varorna en gång till?'))return;
  const plan=ReceiptTools.plan(items,receiptRows,()=>crypto.randomUUID());
  const record={id:crypto.randomUUID(),at:new Date().toISOString(),source:receiptFile?.name||'Inklistrad kvittotext',sourceHash,fileHash:receiptFileHash,rows:plan.rows,units:plan.units};
  // The complete new inventory is persisted before changing the visible state.
  try{localStorage.setItem(key,JSON.stringify(plan.items))}catch{receiptError('Lagret kunde inte sparas. Inga varor importerades. Frigör utrymme eller tillåt lagring i webbläsaren och försök igen.');return}
  items=plan.items;receiptHistory=[record,...receiptHistory].slice(0,100);
  let historySaved=true;try{localStorage.setItem(receiptHistoryKey,JSON.stringify(receiptHistory))}catch{historySaved=false}
  $('#receipt').close();render();
  toast(historySaved?plan.units+' förpackningar har lagts till i lagret.':'Varorna sparades, men kvittohistoriken kunde inte sparas.');
 }catch(error){receiptError(error.message||'Importen kunde inte slutföras. Kontrollera varuraderna.')}
 finally{receiptCommitting=false;updateReceiptSummary()}
}
window.renderReceipts=function(){
 const active=view==='receipts';$('.inventory').hidden=active;$('#receipts-page').hidden=!active;
 $('#receipt-badge').textContent=receiptHistory.length;
 if(!active)return;
 $('#r-history').innerHTML=receiptHistory.length?receiptHistory.map(r=>`<article class="receipt-history-row"><div class="receipt-history-icon" aria-hidden="true">▤</div><div><h3>${esc(r.source||'Kvitto')}</h3><p>${esc(new Date(r.at).toLocaleString('sv-SE',{dateStyle:'medium',timeStyle:'short'}))}</p></div><span>${Number(r.rows)||0} varurader<br><small>${Number(r.units)||0} förpackningar</small></span></article>`).join(''):'<div class="empty"><h3>Ditt nästa inköp, på ett kvitto</h3><p>Importerade kvitton visas här. Börja med en bild, PDF eller kvittotext.</p></div>';
};
$('#receipt-open').onclick=$('#receipt-new').onclick=openReceipt;
$('#r-camera').onclick=()=>$('#r-camera-input').click();$('#r-upload-button').onclick=()=>$('#r-upload').click();
$('#r-camera-input').onchange=e=>selectReceiptFile(e.target.files[0]);$('#r-upload').onchange=e=>selectReceiptFile(e.target.files[0]);
$('#r-text').oninput=()=>{$('#r-read').disabled=!$('#r-text').value.trim()&&!receiptFile};
$('#r-rotate').onclick=()=>{receiptRotation=(receiptRotation+90)%360;$('#r-preview').style.transform='rotate('+receiptRotation+'deg)'};
$('#r-read').onclick=readReceipt;
$('#r-cancel').onclick=()=>{cancelReceiptJob();receiptStage('input');receiptError('Avläsningen avbröts. Inga varor har lagts till.')};
$('#receipt').addEventListener('close',()=>{receiptSession++;cancelReceiptJob();releaseReceiptPreview();receiptFile=null});
$('#r-back').onclick=()=>{receiptStage('input');receiptError('')};
$('#r-reparse').onclick=()=>{try{prepareReceiptRows($('#r-raw').value)}catch(error){receiptError(error.message)}};
$('#r-addrow').onclick=()=>{if(receiptRows.length>=200){receiptError('Högst 200 varurader kan importeras åt gången.');return}receiptRows.push({name:'',qty:1,cat:'Skafferi',note:'Tillagd manuellt',selected:true,match:''});renderReceiptRows();$('#r-rows').lastElementChild.querySelector('[data-field="name"]').focus()};
$('#r-all').onchange=e=>{receiptRows.forEach(r=>r.selected=e.target.checked);renderReceiptRows()};
$('#r-rows').oninput=e=>{
 const field=e.target.dataset.field,container=e.target.closest('[data-row]');if(!field||!container)return;
 const row=receiptRows[Number(container.dataset.row)];if(!row)return;
 row[field]=field==='selected'?e.target.checked:field==='qty'?(e.target.value===''?NaN:Number(e.target.value)):e.target.value;
 if(field==='match'){
  const match=items.find(i=>i.id===row.match);if(match)row.cat=match.cat;
  const catInput=container.querySelector('[data-field="cat"]');catInput.value=row.cat;catInput.disabled=!!match;
 }
 updateReceiptSummary();
};
$('#r-import').onclick=commitReceipt;
window.addEventListener('pagehide',cancelReceiptJob);
renderReceipts();
