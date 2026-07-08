import { useRef, useEffect, cloneElement, type ReactElement } from 'react';

interface ClickOutsideProps {
  children: ReactElement;
  onClick: (e: MouseEvent) => void;
}

const ClickOutside = ({ children, onClick }: ClickOutsideProps) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.button === 2) return; // let onContextMenu's own toggle logic handle right-clicks
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClick(e);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClick]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cloneElement(children, { ref } as any);
};

export default ClickOutside;
