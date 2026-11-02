/** Compare collapsed boundary ranges so both selection handles can move without a new highlight. */
export function rangesOverlap(a:Range,b:Range):boolean{
 if(a.startContainer.ownerDocument!==b.startContainer.ownerDocument)return false;
 const as=a.cloneRange(),ae=a.cloneRange(),bs=b.cloneRange(),be=b.cloneRange();
 as.collapse(true);ae.collapse(false);bs.collapse(true);be.collapse(false);
 return as.compareBoundaryPoints(0,be)<0&&ae.compareBoundaryPoints(0,bs)>0;
}
/** EPUB.js treats element child offsets as character offsets; convert them to real text boundaries. */
export function textSelectionRange(range:Range):Range{
 if(range.startContainer.nodeType===3&&range.endContainer.nodeType===3)return range.cloneRange();
 const doc=range.startContainer.ownerDocument;if(!doc)return range.cloneRange();
 const walker=doc.createTreeWalker(range.commonAncestorContainer,4),nodes:Text[]=[];let node:Node|null;
 while((node=walker.nextNode())){if(!node.textContent?.length)continue;const part=doc.createRange();part.selectNodeContents(node);if(rangesOverlap(range,part))nodes.push(node as Text);}
 if(!nodes.length)return range.cloneRange();
 const first=nodes[0],last=nodes[nodes.length-1],result=doc.createRange();
 result.setStart(first,first===range.startContainer?range.startOffset:0);
 result.setEnd(last,last===range.endContainer?range.endOffset:last.length);
 return result;
}
export function repairParagraphRange(range:Range,quote:string):Range|null{
 const clean=(text:string)=>text.replace(/\s+/g,' ').trim();
 if(clean(range.toString())===clean(quote))return null;
 const paragraph=range.startContainer.parentElement?.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6');
 if(!paragraph||clean(paragraph.textContent||'')!==clean(quote))return null;
 const full=paragraph.ownerDocument.createRange();full.selectNodeContents(paragraph);
 return textSelectionRange(full);
}
