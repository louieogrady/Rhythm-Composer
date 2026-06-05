interface CellProps {
  stepToggle: (x: number, y: number) => void;
  x: number;
  y: number;
  activeColumn: number;
  steps: number[][];
}

const Cell = ({ stepToggle, x, y, activeColumn, steps }: CellProps) => {
  const isOn = steps[x][y] === 1;
  const isBeat = y % 4 === 0;
  const isActive = activeColumn === y;

  return (
    <div className={`box${isActive ? ' box--active' : ''}`}>
      <div
        className={`inner${isOn ? ' inner--on' : isBeat ? ' inner--beat' : ''}`}
        onClick={() => stepToggle(x, y)}
      />
    </div>
  );
};

export default Cell;
