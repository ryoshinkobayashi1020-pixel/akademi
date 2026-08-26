import { readRole } from '../../auth';

const DOMAIN_HINT = '青年会議所、JC、JCI、松任、白山市、白山青年会議所、アカデミー委員会、事業計画書、議案、審議対象資料、参考資料、資料一覧、ハイパーリンク、白山検定、駅前、松任駅';

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'GPT APIキーがまだ設定されていません' }, { status: 503 });
  const incoming = await request.formData();
  const audio = incoming.get('audio');
  if (!(audio instanceof Blob)) return Response.json({ error: '音声データがありません' }, { status: 400 });

  const form = new FormData();
  form.append('file', audio, 'speech.webm');
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('language', 'ja');
  form.append('prompt', DOMAIN_HINT);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return Response.json({ error: '文字起こしに失敗しました' }, { status: 502 });
  const data = (await res.json()) as { text?: string };
  return Response.json({ text: data.text ?? '' });
}
