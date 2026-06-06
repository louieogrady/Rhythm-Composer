import { useState } from 'react';
import { Knob } from '../lib';

interface PatternSelectorProps {
  changePatternSelector: (value: number) => void;
}

const PatternSelector = ({ changePatternSelector }: PatternSelectorProps) => {
  const [value, setValue] = useState(0);

  const handleChange = (v: number) => {
    setValue(v);
    changePatternSelector(v);
  };

  return (
    <div>
      <Knob
        min={0}
        max={4}
        value={value}
        onChange={handleChange}
        label="Pattern Selector"
      />
    </div>
  );
};

export default PatternSelector;
