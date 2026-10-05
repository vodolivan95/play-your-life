import { spheres } from '../../game';
export const cityPositions = spheres.map((s, i) => ({ id: s.id, x: (i % 3 - 1) * 10, z: (Math.floor(i / 3) - 1) * 8 }));
