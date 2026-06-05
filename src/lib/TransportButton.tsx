import { type ReactNode } from 'react';

interface TransportButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  wide?: boolean;
}

export const TransportButton = ({ icon, label, onClick, active = false, wide = false }: TransportButtonProps) => {
  return (
    <button
      className={`trans-button${wide ? ' wide' : ''}${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <div className="button-inner">
        <span className="button-icon">{icon}</span>
        <span className="icon-text">{label}</span>
      </div>
    </button>
  );
};
