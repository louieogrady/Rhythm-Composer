interface RecordStopProps {
  stopRecord: () => void;
}

const RecordStop = ({ stopRecord }: RecordStopProps) => {
  return (
    <div onClick={stopRecord}>
      <button className="record stop button">
        <i style={{ fontSize: '1.2vw' }} className="stop icon" />Stop Recording
      </button>
    </div>
  );
};

export default RecordStop;
