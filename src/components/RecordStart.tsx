import { useState } from 'react';

interface RecordStartProps {
  record: () => void;
}

const RecordStart = ({ record }: RecordStartProps) => {
  const [recording, setRecording] = useState(false);

  const handleClick = () => {
    record();
    setRecording(r => !r);
  };

  return (
    <div onClick={handleClick}>
      <button className="record start button">
        <i style={{ fontSize: '1.2vw' }} className={recording ? 'red circle icon' : 'circle icon'} />
        {recording ? 'Recording...' : 'Record'}
      </button>
    </div>
  );
};

export default RecordStart;
