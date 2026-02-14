import { useRef, useState, useCallback, useEffect } from 'react';

interface RecorderState {
  recording: boolean;
  duration: number;
  blob: Blob | null;
  error: string;
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({ recording: false, duration: 0, blob: null, error: '' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const startingRef = useRef(false);

  const stopHardware = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 如果在 getUserMedia 等待期间已被取消
      if (!startingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState((s) => ({ ...s, recording: false, blob }));
      };
      recorder.start();
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, duration: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
      }, 200);
      setState({ recording: true, duration: 0, blob: null, error: '' });
    } catch {
      setState((s) => ({ ...s, error: 'Microphone access denied' }));
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    startingRef.current = false;
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => () => { stopHardware(); }, [stopHardware]);

  const reset = useCallback(() => {
    stopHardware();
    startingRef.current = false;
    setState({ recording: false, duration: 0, blob: null, error: '' });
  }, [stopHardware]);

  return { ...state, start, stop, reset };
}
