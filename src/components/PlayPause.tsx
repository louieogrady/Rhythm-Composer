import { useState } from 'react';

interface PlayPauseProps {
  play: () => void | Promise<void>;
  pause: () => void;
}

const PlayPause = ({ play, pause }: PlayPauseProps) => {
  const [playing, setPlaying] = useState(false);

  const handleClick = () => {
    playing ? pause() : play();
    setPlaying(p => !p);
  };

  return (
    <button className="trans-button" onClick={handleClick}>
      <div className="button-inner">
        <span className="button-icon">{playing ? '⏸' : '▶'}</span>
        <span className="icon-text">{playing ? 'Pause' : 'Play'}</span>
      </div>
    </button>
  );
};

export default PlayPause;
