import { useState } from 'react';

interface TitleProps {
  showInfoPopup: () => void;
  showFreqPopup: () => void;
}

const Title = ({ showInfoPopup, showFreqPopup }: TitleProps) => {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <>
      <h1>Rhythm Composer</h1>
      <button className="info-button" onClick={showInfoPopup}>About</button>
      <button className="info-button ref" onClick={showFreqPopup}>Freq Ref</button>
      <button className={`copy-url-button${copied ? ' blue' : ''}`} onClick={copyUrl}>
        {copied ? 'URL Copied!' : 'Copy URL'}
      </button>
    </>
  );
};

export default Title;
