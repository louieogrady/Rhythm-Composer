import * as Tone from 'tone';

const Hihat = () => {
  const handleClick = () => {
    const noiseSynth = new Tone.NoiseSynth().toDestination();
    noiseSynth.triggerAttackRelease('16n');
  };

  return (
    <div>
      <button onClick={handleClick}>Hihat</button>
    </div>
  );
};

export default Hihat;
