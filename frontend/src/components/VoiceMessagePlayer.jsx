import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { formatAudioDuration } from "../lib/utils";

const VoiceMessagePlayer = ({ src, isSender }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn("Audio play error:", err));
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl min-w-[220px] sm:min-w-[260px] ${
        isSender ? "bg-primary-focus/30 text-primary-content" : "bg-base-300/60 text-base-content"
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        type="button"
        className={`size-9 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 ${
          isSender
            ? "bg-primary-content text-primary hover:bg-white"
            : "bg-primary text-primary-content hover:bg-primary-focus"
        }`}
      >
        {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 ml-0.5 fill-current" />}
      </button>

      {/* Progress & Waveform style bar */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <input
          type="range"
          min="0"
          max="100"
          value={isNaN(progress) ? 0 : progress}
          onChange={handleSeek}
          className={`range range-xs cursor-pointer ${
            isSender ? "accent-primary-content" : "range-primary"
          }`}
        />
        <div className="flex justify-between items-center text-[10px] opacity-75 font-mono">
          <span>{formatAudioDuration(currentTime)}</span>
          <span>{formatAudioDuration(duration || 0)}</span>
        </div>
      </div>

      <Volume2 className="size-4 opacity-60 shrink-0" />
    </div>
  );
};

export default VoiceMessagePlayer;
