import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui.jsx';

// اختيار الزبون يُحفظ في المتصفح: إذا أوقف الموسيقى أو كتمها تبقى كذلك حتى يشغّلها بنفسه
const KEY = 'tb:music';
function readPref() {
  try { return { paused: false, muted: false, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { paused: false, muted: false }; }
}

let ytPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; // مشغّل يوتيوب الرسمي (IFrame Player API)
      s.onerror = () => { ytPromise = null; reject(new Error('youtube')); };
      document.head.appendChild(s);
    });
  }
  return ytPromise;
}

export default function Music({ config }) {
  const [pref, setPref] = useState(readPref);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const engine = useRef(null);
  const ytHost = useRef(null);
  const prefRef = useRef(pref);
  prefRef.current = pref;

  const sig = config ? `${config.source}|${config.url || config.youtubeId}|${config.volume}` : '';

  useEffect(() => {
    if (!config) return undefined;
    let dead = false;
    let timer = null;
    setPlaying(false); setBlocked(false); setFailed(false);
    const start = prefRef.current;

    if (config.source === 'file') {
      const a = new Audio(config.url);
      a.loop = true;
      a.preload = 'auto';
      a.volume = Math.min(1, Math.max(0, config.volume / 100));
      a.muted = start.muted;
      a.addEventListener('playing', () => { setPlaying(true); setBlocked(false); });
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('error', () => setFailed(true));
      engine.current = { play: () => a.play(), pause: () => a.pause(), mute: (m) => { a.muted = m; } };
      // نحاول التشغيل فور الدخول. إذا منعه المتصفح نُظهر زر «تشغيل الموسيقى»
      if (!start.paused) a.play().catch(() => !dead && setBlocked(true));
      return () => { dead = true; a.pause(); a.removeAttribute('src'); a.load(); engine.current = null; };
    }

    let player = null;
    const mount = document.createElement('div');
    ytHost.current?.appendChild(mount);
    loadYouTubeApi().then((YT) => {
      if (dead) return;
      player = new YT.Player(mount, {
        width: 200, height: 113, videoId: config.youtubeId,
        playerVars: { autoplay: start.paused ? 0 : 1, loop: 1, playlist: config.youtubeId, controls: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: (e) => {
            if (dead) return;
            e.target.setVolume(config.volume);
            if (prefRef.current.muted) e.target.mute();
            engine.current = {
              play: () => e.target.playVideo(), pause: () => e.target.pauseVideo(),
              mute: (m) => (m ? e.target.mute() : e.target.unMute()),
            };
            if (!prefRef.current.paused) {
              e.target.playVideo();
              timer = setTimeout(() => { if (!dead && e.target.getPlayerState?.() !== 1) setBlocked(true); }, 2600);
            }
          },
          onStateChange: (e) => {
            if (dead) return;
            if (e.data === 1) { setPlaying(true); setBlocked(false); }
            else if (e.data === 0) e.target.playVideo();
            else if (e.data === 2 || e.data === 5 || e.data === -1) setPlaying(false);
          },
          onError: () => !dead && setFailed(true),
        },
      });
    }).catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
      clearTimeout(timer);
      try { player?.destroy?.(); } catch { /* المشغّل لم يكتمل تحميله */ }
      mount.remove();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  if (!config || failed) return null;

  const save = (next) => {
    setPref(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* تخزين المتصفح معطّل */ }
  };
  const play = () => {
    save({ ...pref, paused: false });
    setBlocked(false);
    Promise.resolve(engine.current?.play()).catch(() => setBlocked(true));
  };
  const pause = () => { save({ ...pref, paused: true }); engine.current?.pause(); };
  const toggleMute = () => { const muted = !pref.muted; save({ ...pref, muted }); engine.current?.mute(muted); };

  return (
    <div className="music">
      <div className="music-yt" ref={ytHost} aria-hidden="true" />
      {blocked && !playing ? (
        <button className="music-start" onClick={play}><Icon name="play" size={16} fill /> تشغيل الموسيقى</button>
      ) : (
        <>
          <button className={`icon-btn ${playing ? 'is-on' : ''}`} onClick={playing ? pause : play}
            aria-label={playing ? 'إيقاف الموسيقى' : 'تشغيل الموسيقى'} title={playing ? 'إيقاف الموسيقى' : 'تشغيل الموسيقى'}>
            {playing ? <span className="eq" aria-hidden="true"><i /><i /><i /></span> : <Icon name="music" />}
          </button>
          <button className="icon-btn" onClick={toggleMute} aria-pressed={pref.muted}
            aria-label={pref.muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'} title={pref.muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}>
            <Icon name={pref.muted ? 'mute' : 'volume'} />
          </button>
        </>
      )}
    </div>
  );
}
