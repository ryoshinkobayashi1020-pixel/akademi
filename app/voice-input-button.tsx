'use client';
import { useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function VoiceInputButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const lastIndexRef = useRef(0);

  useEffect(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = lastIndexRef.current; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      lastIndexRef.current = e.results.length;
      if (text.trim()) onResult(text);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wantListeningRef.current = false;
      setListening(false);
    };
    rec.onend = () => {
      if (wantListeningRef.current) {
        lastIndexRef.current = 0;
        try { rec.start(); } catch { /* already starting */ }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    return () => { wantListeningRef.current = false; rec.onend = null; rec.stop(); };
  }, [onResult]);

  function toggle() {
    if (!recRef.current) return;
    if (listening) {
      wantListeningRef.current = false;
      recRef.current.stop();
      setListening(false);
    } else {
      wantListeningRef.current = true;
      lastIndexRef.current = 0;
      recRef.current.start();
      setListening(true);
    }
  }

  if (!supported) return null;
  return (
    <button type="button" className={`voice-button${listening ? ' listening' : ''}`} onClick={toggle} title="音声入力">
      {listening ? '● 聞き取り中…（タップで停止）' : '🎤 音声入力'}
    </button>
  );
}
