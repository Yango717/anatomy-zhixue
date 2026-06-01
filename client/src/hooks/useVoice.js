import { useState, useRef, useCallback, useEffect } from 'react';

// Browser compatibility check
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const synth = window.speechSynthesis;

export default function useVoice({ lang = 'zh-CN', onResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const isCancelledRef = useRef(false);
  const touchStartY = useRef(0);

  const isRecognitionSupported = !!SpeechRecognition;
  const isSynthSupported = !!synth;

  // ─── Speech Recognition ───

  const startListening = useCallback(() => {
    if (!isRecognitionSupported) {
      onError?.({ type: 'unsupported', message: '浏览器不支持语音识别，请使用Chrome或Edge浏览器' });
      return;
    }

    isCancelledRef.current = false;
    setInterimText('');

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimText(final + interim);

      if (final && !isCancelledRef.current) {
        recognition.stop();
        setIsListening(false);
        onResult?.(final.trim());
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        onError?.({ type: 'permission', message: '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问' });
      } else if (event.error !== 'aborted') {
        onError?.({ type: event.error, message: `语音识别错误: ${event.error}` });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    // Simulate volume level (SpeechRecognition doesn't provide audio levels)
    let volInterval = setInterval(() => {
      setVolumeLevel(Math.random() * 0.6 + 0.3); // Simulated 0.3-0.9
    }, 100);

    recognition.onend = () => {
      clearInterval(volInterval);
      setVolumeLevel(0);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      clearInterval(volInterval);
      setVolumeLevel(0);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        onError?.({ type: 'permission', message: '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问' });
      } else if (event.error !== 'aborted') {
        onError?.({ type: event.error, message: `语音识别错误: ${event.error}` });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isRecognitionSupported, lang, onResult, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      isCancelledRef.current = false;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const cancelListening = useCallback(() => {
    if (recognitionRef.current) {
      isCancelledRef.current = true;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  // ─── Touch tracking for slide-to-cancel ───
  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches?.[0]?.clientY || 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    const currentY = e.touches?.[0]?.clientY || 0;
    const deltaY = touchStartY.current - currentY;
    // If slid up more than 50px, cancel
    if (deltaY > 50) {
      cancelListening();
    }
    return deltaY;
  }, [cancelListening]);

  // ─── Speech Synthesis (Doubao TTS) ───
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map()); // text → { blobUrl, timestamp }

  function getTtsKey() { return localStorage.getItem('doubao_tts_key') || ''; }
  function getTtsAppId() { return localStorage.getItem('doubao_tts_appid') || ''; }

  // Fetch TTS — try direct Doubao V3 first (fast), fall back to server proxy
  async function fetchTTS(text) {
    const ttsKey = getTtsKey();
    if (!ttsKey) return null;

    const speaker = getTtsAppId() || 'zh_female_xiaohe_uranus_bigtts';
    const reqid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Try direct Doubao V3 API first (no server hop = faster)
    try {
      const res = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': ttsKey,
          'X-Api-Resource-Id': 'seed-tts-2.0',
          'X-Api-Request-Id': reqid,
        },
        body: JSON.stringify({
          user: { uid: 'anatomy_student' },
          req_params: {
            text, speaker,
            audio_params: { format: 'mp3', sample_rate: 24000 },
            reqid,
          },
        }),
      });

      if (res.ok) {
        const raw = await res.text();
        const lines = raw.split('\n').filter((l) => l.trim());
        let audioBase64 = '';
        for (const line of lines) {
          try { const json = JSON.parse(line); if (json.data) audioBase64 += json.data; } catch {}
        }
        if (audioBase64) {
          const blob = new Blob(
            [Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))],
            { type: 'audio/mp3' }
          );
          return URL.createObjectURL(blob);
        }
      }
    } catch { /* CORS or network error — fall through to server proxy */ }

    // Fallback: server proxy
    const res = await fetch('/api/v1/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ttsKey, ttsAppId: speaker }),
    });
    if (!res.ok) throw new Error('TTS failed');
    const json = await res.json();
    const audioBase64 = json.data?.audio;
    if (!audioBase64) throw new Error('No audio');

    const blob = new Blob(
      [Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))],
      { type: 'audio/mp3' }
    );
    return URL.createObjectURL(blob);
  }

  // Prefetch audio into cache (call as soon as text appears, without playing)
  const prefetch = useCallback(async (text) => {
    if (!text || !getTtsKey()) return;
    const cache = cacheRef.current;
    if (cache.has(text)) return; // already cached

    try {
      const url = await fetchTTS(text);
      if (url) {
        cache.set(text, { url, time: Date.now() });
        // Limit cache to 20 entries
        if (cache.size > 20) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
          if (oldest) { URL.revokeObjectURL(oldest[1].url); cache.delete(oldest[0]); }
        }
      }
    } catch { /* silent fail for prefetch */ }
  }, []);

  const speak = useCallback(async (text, rate = 1.0) => {
    if (!text) return;

    const ttsKey = getTtsKey();
    if (!ttsKey) {
      // Fallback to browser TTS
      if (isSynthSupported) {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = rate;
        const voices = synth.getVoices();
        const twVoice = voices.find((v) => v.lang.startsWith('zh-TW'));
        if (twVoice) utterance.voice = twVoice;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
        utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
        synth.speak(utterance);
      }
      return;
    }

    // Stop any ongoing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    synth.cancel();
    setIsPaused(false);
    setIsSpeaking(true);

    try {
      // Check cache first — instant playback if prefetched
      const cache = cacheRef.current;
      let url = cache.get(text)?.url;

      if (!url) {
        // Not cached — fetch now
        url = await fetchTTS(text);
        if (!url) throw new Error('No audio returned');
        cache.set(text, { url, time: Date.now() });
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      setIsSpeaking(false);
      setIsPaused(false);
      // Fallback to browser TTS on error
      if (isSynthSupported) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        const voices = synth.getVoices();
        const twVoice = voices.find((v) => v.lang.startsWith('zh-TW'));
        if (twVoice) utterance.voice = twVoice;
        synth.speak(utterance);
      }
    }
  }, [isSynthSupported]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    synth.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pauseSpeaking = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPaused(true);
    } else if (synth.speaking && !synth.paused) {
      synth.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setIsPaused(false);
    } else if (synth.paused) {
      synth.resume();
      setIsPaused(false);
    }
  }, []);

  // Load voices (some browsers load them async)
  useEffect(() => {
    if (isSynthSupported) {
      const handleVoicesChanged = () => {};
      synth.addEventListener('voiceschanged', handleVoicesChanged);
      // Trigger voice loading
      synth.getVoices();
      return () => synth.removeEventListener('voiceschanged', handleVoicesChanged);
    }
  }, [isSynthSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      synth.cancel();
    };
  }, []);

  return {
    // Recognition
    isListening,
    isRecognitionSupported,
    interimText,
    volumeLevel,
    startListening,
    stopListening,
    cancelListening,
    handleTouchStart,
    handleTouchMove,

    // Synthesis
    isSpeaking,
    isPaused,
    isSynthSupported,
    speak,
    prefetch,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
  };
}
