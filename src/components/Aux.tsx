import { type ReactNode } from 'react';

interface AuxProps { children: ReactNode; }
export const Aux = ({ children }: AuxProps): ReactNode => children;
export default Aux;
