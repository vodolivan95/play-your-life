import type { Goal } from "./game";
import { sphereAssets } from "./sphereAssets";
export function coverSource(goal: Goal) {
  return (
    goal.cover?.url ??
    goal.image ??
    sphereAssets[goal.sphere as keyof typeof sphereAssets]?.building
  );
}
