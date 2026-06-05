interface ClearPatternProps {
  clearPattern: () => void;
}

const ClearPattern = ({ clearPattern }: ClearPatternProps) => {
  return (
    <button className="trans-button" onClick={clearPattern}>
      <div className="button-inner">
        <span className="button-icon">✕</span>
        <span className="icon-text">Clear</span>
      </div>
    </button>
  );
};

export default ClearPattern;
