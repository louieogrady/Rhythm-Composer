interface RandomPatternProps {
  randomPattern: () => void;
}

const RandomPattern = ({ randomPattern }: RandomPatternProps) => {
  return (
    <button className="trans-button wide" onClick={randomPattern}>
      <div className="button-inner">
        <span className="button-icon">⟳</span>
        <span className="icon-text">Randomize</span>
      </div>
    </button>
  );
};

export default RandomPattern;
