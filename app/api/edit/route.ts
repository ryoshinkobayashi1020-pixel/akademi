import { readRole } from '../../auth'; import { currentDocument, saveDocument, MAIN_DOC, MATERIALS_DOC } from '../../document-store';
type Operation={find:string;replace:string};
const decode=(s:string)=>s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
function visible(html:string){const body=html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0]||html;return decode(body.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).slice(0,40000);}
function decodeEntityAt(s:string):{ch:string;len:number}|null{const m=/^&(nbsp|amp|lt|gt|#(\d+));/i.exec(s);if(!m)return null;const ch=m[2]?String.fromCharCode(Number(m[2])):m[1].toLowerCase()==='nbsp'?' ':m[1].toLowerCase()==='amp'?'&':m[1].toLowerCase()==='lt'?'<':'>';return{ch,len:m[0].length};}
function buildFlat(html:string){const flat:string[]=[];const rawStart:number[]=[];let i=0;const n=html.length;let pendingSpace=false;let spaceRawStart=-1;const flush=()=>{if(pendingSpace){flat.push(' ');rawStart.push(spaceRawStart);pendingSpace=false;}};
  while(i<n){const c=html[i];
    if(c==='<'){const end=html.indexOf('>',i);i=end===-1?n:end+1;continue;}
    if(c==='&'){const dec=decodeEntityAt(html.slice(i,i+12));if(dec){if(/\s/.test(dec.ch)){if(!pendingSpace){pendingSpace=true;spaceRawStart=i;}}else{flush();flat.push(dec.ch);rawStart.push(i);}i+=dec.len;continue;}}
    if(/\s/.test(c)){if(!pendingSpace){pendingSpace=true;spaceRawStart=i;}i++;continue;}
    flush();flat.push(c);rawStart.push(i);i++;
  }
  flush();return{flat:flat.join(''),rawStart,endRaw:n};
}
function applyVisible(html:string,op:Operation){const find=op.find.trim().replace(/\s+/g,' ');if(!find)return html;const{flat,rawStart,endRaw}=buildFlat(html);const idx=flat.indexOf(find);if(idx===-1)return html;const startRaw=rawStart[idx];const lastCharIdx=idx+find.length-1;const endRawPos=lastCharIdx+1<rawStart.length?rawStart[lastCharIdx+1]:endRaw;return html.slice(0,startRaw)+op.replace+html.slice(endRawPos);}
export async function POST(request:Request){
  if(await readRole()!=='admin')return Response.json({error:'管理者のみ利用できます'},{status:403});
  if(!process.env.OPENAI_API_KEY)return Response.json({error:'GPT APIキーがまだ設定されていません'},{status:503});
  const {instruction,target}=await request.json() as {instruction?:string;target?:'main'|'materials'};if(!instruction?.trim())return Response.json({error:'修正内容を入力してください'},{status:400});
  const docId=target==='materials'?MATERIALS_DOC:MAIN_DOC;
  const html=await currentDocument(request,docId);const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.4-mini',input:[{role:'developer',content:'You edit a Japanese business-plan document (or its materials-list page). Return exact visible-text replacements. Each find must be copied verbatim from the supplied document, be unique, and under 180 characters. Preserve facts unless instructed. Use multiple operations when needed. If the instruction asks to add a hyperlink, set replace to HTML like <a href="URL" target="_blank">LABEL</a> — inserted right after the matched find text — using an absolute path under /document/... or /api/materials when it refers to an attachment of this project, or the exact URL given in the instruction otherwise.'},{role:'user',content:`修正指示:\n${instruction}\n\n現在の文書:\n${visible(html)}`}],text:{format:{type:'json_schema',name:'document_edit',strict:true,schema:{type:'object',additionalProperties:false,properties:{summary:{type:'string'},operations:{type:'array',items:{type:'object',additionalProperties:false,properties:{find:{type:'string'},replace:{type:'string'}},required:['find','replace']}}},required:['summary','operations']}}}})});
  if(!response.ok)return Response.json({error:'GPTの処理に失敗しました'},{status:502});const data=await response.json() as {output?:Array<{content?:Array<{type:string;text?:string}>}>};const text=data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;if(!text)return Response.json({error:'修正案を取得できませんでした'},{status:502});
  const result=JSON.parse(text) as {summary:string;operations:Operation[]};let updated=html;let changed=0;for(const op of result.operations){const next=applyVisible(updated,op);if(next!==updated){updated=next;changed++;}}
  if(!changed)return Response.json({error:'該当箇所を特定できませんでした。対象の文章をもう少し具体的に指定してください。'},{status:422});await saveDocument(updated,result.summary,docId);return Response.json({summary:`${result.summary}\n${changed}か所を修正し、保存しました。`});
}
