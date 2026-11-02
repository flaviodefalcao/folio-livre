import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import JSZip from 'jszip';
const origin='http://127.0.0.1:5319';

test('Free Android edition: preferences, public search, filtered links, real EPUB import and reader', {timeout:90000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5319','--strictPort'],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const zip=await JSZip.loadAsync(await readFile(new URL('../public/sample.epub',import.meta.url)));
  zip.file('OEBPS/content.opf',(await zip.file('OEBPS/content.opf').async('string')).replace('A arte de ler devagar','Livro gratuito de teste').replace('urn:folio:original-demo-1','urn:folio-livre:test'));
  const bytes=Array.from(await zip.generateAsync({type:'uint8array'}));
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(bytes=>{
   const book={id:'0123456789abcdef0123456789abcdef',title:'Livro gratuito de teste',author:'Autor de teste',language:'pt',format:'epub',url:'https://annas-archive.gl/md5/0123456789abcdef0123456789abcdef'};
   window.__downloads=[];window.__saved=[];window.__opened=[];
   window.folio={getSettings:async()=>({annaUrl:'https://annas-archive.gl',supportsIntegratedCatalog:true}),saveSettings:async input=>{window.__saved.push(input);return {...input,supportsIntegratedCatalog:true};},openExternal:async()=>{},exportFile:async()=>true,
    openCatalog:async(url,options)=>{window.__opened.push({url,options});if(options?.collect==='search')window.dispatchEvent(new CustomEvent('folio-catalog-results',{detail:{results:[book],page:1,hasMore:false,query:new URL(url).searchParams.get('q')}}));},
    catalogLinks:async()=>({options:[{id:'paid',label:'Fast download',url:'https://annas-archive.gl/fast_download/0123456789abcdef0123456789abcdef/0/0',kind:'page'},{id:'free',label:'EPUB gratuito',url:'https://example.org/livro.epub',kind:'direct'},{id:'wait',label:'Servidor gratuito com espera',url:'https://annas-archive.gl/slow_download/0123456789abcdef0123456789abcdef/0/0',kind:'page'}]}),
    download:async url=>{window.__downloads.push(url);return {name:'livro.epub',data:new Uint8Array(bytes)};}
   };
  },bytes);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(origin);
  await expect(page.getByRole('button',{name:'Ler A arte de ler devagar',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Entrelinhas|Recomendações|Conversar/})).toHaveCount(0);
  await page.getByRole('button',{name:'Mais',exact:true}).tap();
  await page.locator('.mobile-more').getByRole('button',{name:'Preferências',exact:true}).tap();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('input[type=password]')).toHaveCount(0);
  await expect(dialog.getByText(/OpenAI|premium|chave|modelo/i)).toHaveCount(0);
  await dialog.getByRole('combobox',{name:'Tema do aplicativo'}).selectOption('light');
  await dialog.getByRole('button',{name:'Salvar preferências'}).tap();
  assert.deepEqual(await page.evaluate(()=>window.__saved),[{annaUrl:'https://annas-archive.gl/'}]);
  await page.getByRole('button',{name:'Descobrir livros',exact:true}).tap();
  await page.getByRole('textbox',{name:'Título ou autor'}).fill('Livro gratuito de teste');
  await page.locator('form.native-search').getByRole('button',{name:'Buscar',exact:true}).tap();
  await expect(page.getByRole('heading',{name:'Livro gratuito de teste'})).toBeVisible();
  const opened=await page.evaluate(()=>window.__opened);const u=new URL(opened[0].url);
  assert.equal(u.searchParams.get('q'),'Livro gratuito de teste');assert.equal(u.searchParams.get('ext'),'epub');assert.equal(opened[0].options.collect,'search');
  await mkdir('research',{recursive:true});await page.screenshot({path:'research/folio-livre-catalog.png'});
  await page.getByRole('button',{name:'Ver links gratuitos'}).tap();
  await expect(page.getByRole('dialog').getByText('EPUB gratuito',{exact:true})).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Fast download',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Abrir link gratuito',exact:true}).tap();
  assert.ok((await page.evaluate(()=>window.__opened)).some(o=>o.url.includes('/slow_download/')));
  await page.getByRole('button',{name:'Baixar EPUB',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Ler Livro gratuito de teste',exact:true})).toBeVisible();
  assert.deepEqual(await page.evaluate(()=>window.__downloads),['https://example.org/livro.epub']);
  await page.reload();await page.getByRole('button',{name:'Ler Livro gratuito de teste',exact:true}).tap();
  await expect(page.locator('.reader-loading')).toHaveCount(0);
  await expect(page.frameLocator('.epub-container iframe').first().locator('h1')).toHaveText('Um lugar para a atenção');
  await expect(page.getByRole('button',{name:/Conversar|Perguntar à IA/})).toHaveCount(0);
  await page.getByRole('button',{name:'Marcar página',exact:true}).tap();
  await page.getByRole('button',{name:'Buscar no livro',exact:true}).tap();
  await page.getByPlaceholder('Uma palavra ou expressão…').fill('atenção');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await page.getByRole('button',{name:'Fechar painel',exact:true}).tap();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await mkdir('research',{recursive:true});await page.screenshot({path:'research/folio-livre-reader.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
});
