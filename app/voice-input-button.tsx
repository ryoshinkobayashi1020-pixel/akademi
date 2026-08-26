'use client';
import { useRef, useState } from 'react';

export default function VoiceInputButton({ onResult }: { onResult: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported] = useState(() => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    if (recording || busy) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setBusy(true);
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const form = new FormData();
      form.append('audio', blob, 'speech.webm');
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (data.text?.trim()) onResult(data.text.trim());
      } finally {
        setBusy(false);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  if (!supported) return null;
  return (
    <button
      type="button"
      className={`voice-button${recording ? ' listening' : ''}`}
      disabled={busy}
      onClick={recording ? stop : start}
      title="音声入力"
    >
      {busy ? '文字起こし中…' : recording ? '● 録音中…（タップで文字起こし）' : '🎤 音声入力'}
    </button>
  );
}
