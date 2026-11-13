/**
 * useRecorder.ts — registrazione audio del DETTATO (giro 25), adattata dalla
 * repo https://github.com/andreakeating1982/AUDIO-MATEMATICI
 * (client/src/hooks/useRecorder.ts).
 *
 * Registra con MediaRecorder (direttamente nel browser), converte la
 * registrazione in WAV PCM 16 kHz in-process (niente file temporanei sul
 * client) e la invia a /api/ai/audio, che trascrive con l'IA e converte in
 * notazione matematica (MAI calcolare).
 *
 * La registrazione si ferma DA SOLA dopo MAX_RECORDING_SECONDS: il limite
 * tiene il messaggio verso l'IA (audio in base64) sotto la soglia del gateway.
 * Allo scadere, la trascrizione parte DA SOLA e il risultato viene pubblicato
 * in `autoResult` (24/10: prima andava perso se l'utente non premeva di nuovo
 * il microfono). Per espressioni lunghe l'utente detta più audios di seguito:
 * ogni audio diventa un PEZZO, come quelli scritti a mano.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface TranscribeResult {
  spoken: string;
  notation: string;
}

/** Durata massima di una singola registrazione, in secondi */
export const MAX_RECORDING_SECONDS = 20;

/** Converte un Blob audio in WAV (PCM 16-bit mono); null se non supportato */
async function blobToWav(blob: Blob, sampleRate = 16000): Promise<Blob | null> {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const url = URL.createObjectURL(new Blob([blob], { type: blob.type }));
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const ctx = new Ctx();
      const decoded = await ctx.decodeAudioData(arr.slice(0));
      await ctx.close().catch(() => undefined);
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
      const src = offline.createBufferSource();
      src.buffer = decoded;
      src.connect(offline.destination);
      src.start(0);
      const rendered = await offline.startRendering();
      return bufferToWavBlob(rendered);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

function bufferToWavBlob(buf: AudioBuffer): Blob {
  const channel = buf.getChannelData(0);
  const bytesPer = 2;
  const data = new DataView(new ArrayBuffer(44 + channel.length * bytesPer));
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) data.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  data.setUint32(4, 36 + channel.length * bytesPer, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * bytesPer, true);
  data.setUint16(32, bytesPer, true);
  data.setUint16(34, 16, true);
  writeStr(36, "data");
  data.setUint32(40, channel.length * bytesPer, true);
  for (let i = 0; i < channel.length; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]));
    data.setInt16(44 + i * bytesPer, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([data.buffer], { type: "audio/wav" });
}

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /* (24/10) ultimo risultato da AUTO-STOP allo scadere dei 20 s: la pagina lo
     accoda da sola (stessa logica del secondo tocco). Resta l'ultimo valore:
     la pagina lo consuma una sola volta (seenRef) e `reset()` lo azzera. */
  const [autoResult, setAutoResult] = useState<TranscribeResult | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<(() => Promise<void>) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (recorderRef.current?.state === "recording") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Questo browser non consente l'accesso al microfono.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", ""];
      const mime =
        types.find((t) => t === "" || (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t))) ?? "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => setRecording(false);
      recorderRef.current = rec;
      streamRef.current = stream;
      rec.start(250);
      setRecording(true);

      // conto alla rovescia: auto-stop per restare sotto il limite del gateway
      setElapsed(0);
      clearTimer();
      const t0 = Date.now();
      timerRef.current = window.setInterval(() => {
        const s = Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - t0) / 1000));
        setElapsed(s);
        if (s >= MAX_RECORDING_SECONDS) {
          clearTimer();
          void autoStopRef.current?.();
        }
      }, 250);
    } catch {
      setError(
        "Non riesco ad accedere al microfono. Consenti il permesso per questo sito (o apri l'app in una scheda da sola se sei dentro il blog) e riprova.",
      );
      stopStream();
    }
  }, [stopStream, clearTimer]);

  /** Invia un WAV già pronto a /api/ai/audio (JSON base64) e registra il risultato */
  const sendWavForTranscription = useCallback(async (wav: Blob): Promise<TranscribeResult | null> => {
    setTranscribing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Lettura dell'audio non riuscita."));
        fr.readAsDataURL(wav);
      });
      const res = await fetch("/api/ai/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: dataUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        spoken?: string;
        notation?: string;
        error?: string;
      };
      if (!res.ok || !json.notation) {
        throw new Error(json.error ?? `Trascrizione fallita (${res.status})`);
      }
      return { spoken: json.spoken ?? "", notation: json.notation };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trascrizione non riuscita. Riprova.");
      return null;
    } finally {
      setTranscribing(false);
    }
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<TranscribeResult | null> => {
    clearTimer();
    const rec = recorderRef.current;
    if (!rec) return null;
    recorderRef.current = null;

    let raw: Blob;
    if (rec.state === "inactive") {
      // già fermata (doppio tocco o auto-stop sovrapposto): usa i chunk raccolti
      raw = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
    } else {
      const done = new Promise<Blob>((resolve) => {
        const prev = rec.onstop;
        rec.onstop = (ev: Event) => {
          prev?.call(rec, ev);
          resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        };
      });
      rec.stop();
      raw = await done;
    }
    setRecording(false);
    setElapsed(0);
    stopStream();

    const wav = await blobToWav(raw);
    if (!wav) {
      setError("Non riesco a convertire la registrazione: riprova a dettare.");
      return null;
    }
    return sendWavForTranscription(wav);
  }, [stopStream, clearTimer, sendWavForTranscription]);

  /* Auto-stop del timer: ferma, trascrive e PUBBLICA il risultato in
     `autoResult`, così il dettato non si perde anche senza secondo tocco. */
  const autoStop = useCallback(async (): Promise<void> => {
    const res = await stopAndTranscribe();
    if (res) setAutoResult(res);
  }, [stopAndTranscribe]);

  // riferimento sempre aggiornato per l'auto-stop del timer
  useEffect(() => {
    autoStopRef.current = autoStop;
  }, [autoStop]);

  // niente timer residuo allo smontaggio
  useEffect(() => () => clearTimer(), [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    try {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    } catch {
      /* non registrava */
    }
    stopStream();
    recorderRef.current = null;
    setRecording(false);
    setTranscribing(false);
    setElapsed(0);
    setError(null);
    setAutoResult(null);
  }, [stopStream, clearTimer]);

  return {
    recording,
    transcribing,
    elapsed,
    maxSeconds: MAX_RECORDING_SECONDS,
    error,
    autoResult,
    start,
    stopAndTranscribe,
    reset,
    setError,
  };
}
