import ClickOutside from './ClickOutside';

interface InfoPopUpProps {
  showInfoPopup: () => void;
}

const InfoPopUp = ({ showInfoPopup }: InfoPopUpProps) => {
  const handleClickOutside = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).classList.contains('info-button')) {
      showInfoPopup();
    }
  };

  return (
    <ClickOutside onClick={handleClickOutside}>
      <div className="show-info">
        <h1 style={{ textAlign: 'center', fontFamily: 'Lato', color: 'black' }}>Rhythm Composer</h1>
        <p>
          Rhythm Composer is a browser-based drum machine / 16 step sequencer. Users can play,
          create, edit and add effects to drum patterns in real-time. Created with React, each drum
          sound is synthesised with the Tone.js framework.
          <br /><br />
          The grid represents a traditional 4/4 measure with each step representing 1/16 of that
          measure. Downbeats are represented by the orange boxes. Each row of the grid has been
          assigned a drum sound shown by the icons on the left. Each drum sound has an exclusive
          effect, pitch or envelope control adjustable via the knobs on the right.
          <br /><br />
          Drum patterns can be entered by clicking boxes in the grid. A blue box is activated and
          will be triggered at that step. When playing, the orange outline shows the current
          position. The randomize button creates a random pattern.
          <br /><br />
          Best experienced on a desktop computer.
          <br /><br />
          By <a href="https://github.com/louieogrady">Louie O&apos;Grady.</a>
        </p>
      </div>
    </ClickOutside>
  );
};

export default InfoPopUp;
