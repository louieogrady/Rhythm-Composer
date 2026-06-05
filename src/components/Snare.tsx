import * as Tone from 'tone';

const Snare = () => {
  const handleClick = () => {
    const snare = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.5, decay: 0.1, sustain: 0.02 },
    }).toDestination();
    snare.triggerAttackRelease('8n');
  };

  return (
    <div>
      <button onClick={handleClick}>Snare</button>
    </div>
  );
};

export default Snare;
