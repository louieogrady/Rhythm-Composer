import ClickOutside from './ClickOutside';

interface FreqRow { note: string; freq: string; }

const ROW_TITLES = ['Note', 'Frequency (Hz)'];

const ROW_DATA: FreqRow[] = [
  { note: 'F1',        freq: '43.65' },
  { note: 'F#1/Gb1',  freq: '46.25' },
  { note: 'G1',        freq: '49.00' },
  { note: 'G#1/Ab1',  freq: '51.91' },
  { note: 'A1',        freq: '55.00' },
  { note: 'A#1/Bb1',  freq: '58.27' },
  { note: 'B1',        freq: '61.74' },
  { note: 'C2',        freq: '65.41' },
  { note: 'C#2/Db2',  freq: '69.30' },
  { note: 'D2',        freq: '73.42' },
  { note: 'D#2/Eb2',  freq: '77.78' },
  { note: 'E2',        freq: '82.41' },
  { note: 'F2',        freq: '87.31' },
  { note: 'F#2/Gb2',  freq: '92.50' },
  { note: 'G2',        freq: '98.00' },
  { note: 'G#2/Ab2',  freq: '103.83' },
  { note: 'A2',        freq: '110.00' },
  { note: 'A#2/Bb2',  freq: '116.54' },
  { note: 'B2',        freq: '123.47' },
  { note: 'C3',        freq: '130.81' },
  { note: 'C#3/Db3',  freq: '138.59' },
  { note: 'D3',        freq: '146.83' },
  { note: 'D#3/Eb3',  freq: '155.56' },
  { note: 'E3',        freq: '164.81' },
  { note: 'F3',        freq: '174.61' },
  { note: 'F#3/Gb3',  freq: '185.00' },
  { note: 'G3',        freq: '196.00' },
  { note: 'G#3/Ab3',  freq: '207.65' },
  { note: 'A3',        freq: '220.00' },
  { note: 'A#3/Bb3',  freq: '233.08' },
  { note: 'B3',        freq: '246.94' },
  { note: 'C4',        freq: '261.63' },
  { note: 'C#4/Db4',  freq: '277.18' },
  { note: 'D4',        freq: '293.66' },
  { note: 'D#4/Eb4',  freq: '311.13' },
  { note: 'E4',        freq: '329.63' },
  { note: 'F4',        freq: '349.23' },
  { note: 'F#4/Gb4',  freq: '369.99' },
  { note: 'G4',        freq: '392.00' },
];

const half = Math.ceil(ROW_DATA.length / 2);

const FreqTable = ({ rows }: { rows: FreqRow[] }) => {
  return (
    <table className="freq-popup-table">
      <thead><tr><th>Note</th><th>Hz</th></tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td>{row.note}</td>
            <td>{row.freq}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

interface FreqPopUpProps {
  showFreqPopup: () => void;
}

const FreqPopUp = ({ showFreqPopup }: FreqPopUpProps) => {
  const handleClickOutside = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).classList.contains('info-button')) showFreqPopup();
  };

  return (
    <ClickOutside onClick={handleClickOutside}>
      <div className="show-info show-info--freq">
        <div className="freq-tables">
          <FreqTable rows={ROW_DATA.slice(0, half)} />
          <FreqTable rows={ROW_DATA.slice(half)} />
        </div>
      </div>
    </ClickOutside>
  );
};

export default FreqPopUp;
export { ROW_TITLES };
