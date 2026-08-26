import { readRole } from '../../auth'; import { currentDocument, saveDocument, MAIN_DOC, MATERIALS_20_DOC, MATERIALS_21_DOC } from '../../document-store'; import { parseMaterials } from '../../materials-data';
type Operation={find:string;replace:string};
const decode=(s:string)=>s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
function visible(html:string){const body=html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0]||html;return decode(body.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).slice(0,40000);}
function decodeEntityAt(s:string):{ch:string;len:number}|null{const m=/^&(nbsp|amp|lt|gt|#(\d+));/i.exec(s);if(!m)return null;const ch=m[2]?String.fromCharCode(Number(m[2])):m[1].toLowerCase()==='nbsp'?' ':m[1].toLowerCase()==='amp'?'&':m[1].toLowerCase()==='lt'?'<':'>';return{ch,len:m[0].length};}
function buildFlat(html:string){const flat:string[]=[];const rawStart:number[]=[];const rawLen:number[]=[];let i=0;const n=html.length;let pendingSpace=false;let spaceRawStart=-1;let spaceRawEnd=-1;const flush=()=>{if(pendingSpace){flat.push(' ');rawStart.push(spaceRawStart);rawLen.push(spaceRawEnd-spaceRawStart);pendingSpace=false;}};
  while(i<n){const c=html[i];
    if(c==='<'){const end=html.indexOf('>',i);const next=end===-1?n:end+1;if(!pendingSpace){pendingSpace=true;spaceRawStart=i;}spaceRawEnd=next;i=next;continue;}
    if(c==='&'){const dec=decodeEntityAt(html.slice(i,i+12));if(dec){if(/\s/.test(dec.ch)){if(!pendingSpace){pendingSpace=true;spaceRawStart=i;}spaceRawEnd=i+dec.len;}else{flush();flat.push(dec.ch);rawStart.push(i);rawLen.push(dec.len);}i+=dec.len;continue;}}
    if(/\s/.test(c)){if(!pendingSpace){pendingSpace=true;spaceRawStart=i;}spaceRawEnd=i+1;i++;continue;}
    flush();flat.push(c);rawStart.push(i);rawLen.push(1);i++;
  }
  flush();return{flat:flat.join(''),rawStart,rawLen};
}
function applyVisible(html:string,op:Operation){const find=op.find.trim().replace(/\s+/g,' ');if(!find)return html;const{flat,rawStart,rawLen}=buildFlat(html);const idx=flat.indexOf(find);if(idx===-1)return html;const startRaw=rawStart[idx];const lastCharIdx=idx+find.length-1;const endRawPos=rawStart[lastCharIdx]+rawLen[lastCharIdx];return html.slice(0,startRaw)+op.replace+html.slice(endRawPos);}
export async function POST(request:Request){
  if(await readRole()!=='admin')return Response.json({error:'管理者のみ利用できます'},{status:403});
  if(!process.env.OPENAI_API_KEY)return Response.json({error:'GPT APIキーがまだ設定されていません'},{status:503});
  const {instruction,target}=await request.json() as {instruction?:string;target?:'main'|'materials20'|'materials21'};if(!instruction?.trim())return Response.json({error:'修正内容を入力してください'},{status:400});
  const docId=target==='materials21'?MATERIALS_21_DOC:target==='materials20'?MATERIALS_20_DOC:MAIN_DOC;
  const html=await currentDocument(request,docId);
  let materialsContext='';
  if(docId===MAIN_DOC){
    const [html20,html21]=await Promise.all([currentDocument(request,MATERIALS_20_DOC),currentDocument(request,MATERIALS_21_DOC)]);
    const materials=[...parseMaterials(html20).map(m=>({...m,page:'/api/materials/20'})),...parseMaterials(html21).map(m=>({...m,page:'/api/materials/21'}))];
    if(materials.length)materialsContext=`\n\n参考資料一覧（このプロジェクトに登録済みの資料。タイトルとURLのみで本文までは読めないので、事実関係の裏付けではなくタイトルからの推測・言及・リンク付けの参考として使ってください）:\n${materials.map(m=>`- [${m.section}] ${m.label}: ${m.url} (一覧ページ: ${m.page})`).join('\n')}`;
  }
  const devPrompt='You edit a Japanese business-plan document (or one of its two materials-list pages: 20番/審議対象資料 at /api/materials/20, 21番/参考資料 at /api/materials/21). Return exact visible-text replacements. Each find must be copied verbatim (character-for-character, including spacing) from the supplied document, be unique, and under 180 characters. Preserve facts unless instructed. Use multiple operations when needed. If the instruction asks to add a hyperlink, set replace to HTML like <a href="URL" target="_blank">LABEL</a> — inserted right after the matched find text. Choosing the URL: if the instruction names or clearly points to one specific material from the supplied list, use that material\'s exact URL. If the instruction refers to the 20番/審議対象資料 materials page in general, use /api/materials/20; if it refers to the 21番/参考資料 materials page in general, use /api/materials/21. If the instruction gives an explicit URL, use that. Never guess or substitute an unrelated material\'s URL — if unsure which of the two list pages is meant, ask yourself which item number (20 or 21) the instruction is near, and link there instead of guessing a specific file. A list of the project’s registered reference materials (title + URL only) may be supplied for context; you cannot read their actual file content.';
  const schema={type:'json_schema',name:'document_edit',strict:true,schema:{type:'object',additionalProperties:false,properties:{summary:{type:'string'},operations:{type:'array',items:{type:'object',additionalProperties:false,properties:{find:{type:'string'},replace:{type:'string'}},required:['find','replace']}}},required:['summary','operations']}} as const;
  async function askGpt(userContent:string){
    const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.4-mini',input:[{role:'developer',content:devPrompt},{role:'user',content:userContent}],text:{format:schema}})});
    if(!res.ok)return null;
    const data=await res.json() as {output?:Array<{content?:Array<{type:string;text?:string}>}>};
    const text=data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    if(!text)return null;
    return JSON.parse(text) as {summary:string;operations:Operation[]};
  }
  const result=await askGpt(`修正指示:\n${instruction}\n\n現在の文書:\n${visible(html)}${materialsContext}`);
  if(!result)return Response.json({error:'GPTの処理に失敗しました'},{status:502});
  let updated=html;let changed=0;let failed:Operation[]=[];
  for(const op of result.operations){const next=applyVisible(updated,op);if(next!==updated){updated=next;changed++;}else{failed.push(op);}}
  if(changed===0&&failed.length){
    const retry=await askGpt(`前回の回答の find が本文中に見つかりませんでした。空白や記号の位置まで含めて、現在の文書から一字一句そのままコピーして find を作り直してください。\n\n見つからなかった find:\n${failed.map(f=>`- ${f.find}`).join('\n')}\n\n元の指示:\n${instruction}\n\n現在の文書:\n${visible(html)}${materialsContext}`);
    if(retry){for(const op of retry.operations){const next=applyVisible(updated,op);if(next!==updated){updated=next;changed++;}}if(changed)result.summary=retry.summary;}
  }
  if(!changed)return Response.json({error:'該当箇所を特定できませんでした。対象の文章をもう少し具体的に指定してください。'},{status:422});
  await saveDocument(updated,result.summary,docId);return Response.json({summary:`${result.summary}\n${changed}か所を修正し、保存しました。`});
}
