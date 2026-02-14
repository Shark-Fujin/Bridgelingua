import { useRef, useState, useCallback, useEffect } from 'react';

interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  speed: number;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({ playing: false, currentTime: 0, duration: 0, speed: 1.0 });
  const rafRef = useRef(0);

  const syncTime = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      setState((s) => ({ ...s, currentTime: a.currentTime, duration: a.duration || 0 }));
    }
    rafRef.current = requestAnimationFrame(syncTime);
  }, []);

  const load = useCallback((src: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      cancelAnimationFrame(rafRef.current);
    }
    const a = new Audio(src);
    audioRef.current = a;
    a.playbackRate = state.speed;
    a.onended = () => {
      cancelAnimationFrame(rafRef.current);
      setState((s) => ({ ...s, playing: false }));
    };
    a.onloadedmetadata = () => {
      setState((s) => ({ ...s, duration: a.duration || 0, currentTime: 0 }));
    };
  }, [state.speed]);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play();
    rafRef.current = requestAnimationFrame(syncTime);
    setState((s) => ({ ...s, playing: true }));
  }, [syncTime]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    cancelAnimationFrame(rafRef.current);
    setState((s) => ({ ...s, playing: false }));
  }, []);

  const toggle = useCallback(() => {
    state.playing ? pause() : play();
  }, [state.playing, play, pause]);

  const seek = useCallback((time: number) => {
    const a = audioRef.current;
    if (a) {
      a.currentTime = time;
      setState((s) => ({ ...s, currentTime: time }));
    }
  }, []);

  const setSpeed = useCallback((speed: number) => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
    setState((s) => ({ ...s, speed }));
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  return { ...state, load, play, pause, toggle, seek, setSpeed };
}
