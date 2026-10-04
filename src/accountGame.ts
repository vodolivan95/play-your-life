import { initialState, spheres } from './game.ts';
import type { GameState } from './game.ts';
export function newAccountGame(displayName: string): GameState {
  const state = initialState();
  return {
    ...state,
    profile: {
      name: displayName.trim().slice(0, 30) || 'Игрок',
      avatar: 'character',
      mode: 'personal',
      onboardingComplete: false,
    },
    mainGoalId: null,
    xp: 0,
    coins: 0,
    completed: 0,
    activeDates: [],
    streakClaims: [],
    events: [],
    quests: [],
    goals: [],
    monthlyReflections: {},
    spheres: Object.fromEntries(
      spheres.map((s) => [
        s.id,
        { xp: 0, score: 0, highScore: 0, previousScore: 0 },
      ]),
    ),
    monthlyTracking: {
      since: new Date().toISOString(),
      scores: Object.fromEntries(spheres.map((s) => [s.id, 0])),
    },
  };
}
