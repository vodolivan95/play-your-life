import { createContext } from 'react';
import type { CityState } from './city';

export const CityAppearanceContext = createContext<CityState | undefined>(undefined);
