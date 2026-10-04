import CityBuildingArt from './CityBuildingArt';
import { citySphereIds } from '../city';
import { useId } from 'react';

/** Small vector game illustrations, shared by every screen and crisp at any size. */
export default function GameArt({ kind }: { kind: string }) {
  const id = useId().replace(/:/g, '');
  if (citySphereIds.includes(kind as (typeof citySphereIds)[number])) return <CityBuildingArt id={kind} variant="icon" />;
  const paint = `url(#${id})`;
  const colors: Record<string, [string, string]> = {
    health: ['#ff8fb7', '#f5286d'],
    sport: ['#67d5ff', '#0085e6'],
    growth: ['#64d5ff', '#009ada'],
    english: ['#65c9ff', '#1460b4'],
    finance: ['#ffdb5b', '#efa500'],
    together: ['#5acafa', '#007de0'],
    driving: ['#58c7ff', '#0765b3'],
    tasks: ['#76e1d7', '#10acb4'],
    hobby: ['#aa8ef3', '#7050c1'],
    target: ['#ff8dbb', '#ed3b83'],
    coin: ['#ffe890', '#f5af08'],
    trophy: ['#ffdf64', '#eda00c'],
    fire: ['#ffbc62', '#ff6d28'],
    crown: ['#ffe479', '#efad10'],
  };
  const [light, dark] = colors[kind] ?? colors.target;
  const art: Record<string, React.ReactNode> = {
    health: (
      <>
        <path
          d="M32 53 10 31C-3 13 18 1 32 17 46 1 67 13 54 31Z"
          fill={paint}
        />
        <path
          d="M13 23c0-8 9-12 15-5"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".7"
        />
      </>
    ),
    sport: (
      <>
        <rect x="8" y="28" width="48" height="8" rx="4" fill="#1279be" />
        <rect x="12" y="14" width="10" height="36" rx="5" fill={paint} />
        <rect x="5" y="21" width="8" height="23" rx="4" fill={paint} />
        <rect x="42" y="14" width="10" height="36" rx="5" fill={paint} />
        <rect x="51" y="21" width="8" height="23" rx="4" fill={paint} />
        <path
          d="M16 20v22m30-22v22"
          stroke="#c8f1ff"
          strokeWidth="2"
          opacity=".6"
        />
      </>
    ),
    growth: (
      <>
        <path
          d="M5 13q14-5 27 2 13-7 27-2v38q-14-5-27 2-13-7-27-2Z"
          fill={paint}
        />
        <path
          d="M10 13q12-3 20 3v29q-9-5-20-3Zm44 0q-12-3-20 3v29q9-5 20-3Z"
          fill="#fff"
        />
        <path d="M32 17v32" stroke="#078ac6" strokeWidth="3" />
        <path
          d="M14 21h11m-11 6h11m-11 6h11m14-12h11m-11 6h11m-11 6h11"
          stroke="#c5e6f2"
          strokeWidth="2"
        />
      </>
    ),
    english: (
      <>
        <rect x="5" y="8" width="54" height="48" rx="11" fill="#225caa" />
        <path d="m9 11 46 42M55 11 9 53" stroke="#fff" strokeWidth="9" />
        <path d="m9 11 46 42M55 11 9 53" stroke="#ec5365" strokeWidth="3" />
        <path d="M32 8v48M5 32h54" stroke="#fff" strokeWidth="15" />
        <path d="M32 8v48M5 32h54" stroke="#f0485b" strokeWidth="8" />
        <path d="M15 10h33" stroke="#fff" opacity=".25" strokeWidth="3" />
      </>
    ),
    finance: (
      <>
        <ellipse cx="23" cy="51" rx="17" ry="6" fill="#e6a200" />
        <path d="M6 37v14c0 8 34 8 34 0V37" fill={paint} />
        <ellipse cx="23" cy="37" rx="17" ry="6" fill="#ffde57" />
        <path d="M29 25v18c0 8 29 8 29 0V25" fill={paint} />
        <ellipse cx="43.5" cy="25" rx="14.5" ry="6" fill="#ffe17a" />
        <path d="M29 17v9c0 8 29 8 29 0v-9" fill={paint} />
        <ellipse cx="43.5" cy="17" rx="14.5" ry="6" fill="#ffe994" />
        <path
          d="M43 12v10m3-8h-4q-4 2 1 3t-1 3h-3"
          stroke="#df9e0a"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M10 43q13 5 25 0m-25 5q13 5 25 0"
          stroke="#fff"
          opacity=".3"
          fill="none"
        />
      </>
    ),
    together: (
      <>
        <circle cx="22" cy="20" r="9" fill={paint} />
        <circle cx="44" cy="23" r="8" fill={paint} />
        <path d="M6 48v-8c0-18 31-18 31 0v8Z" fill={paint} />
        <path d="M36 48V37c0-11 22-9 22 5v6Z" fill={paint} />
        <path
          d="M13 37q4-6 9-6"
          fill="none"
          stroke="#b3eaff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
    driving: (
      <>
        <path d="m11 29 6-14h30l7 14" fill={paint} />
        <path d="m18 27 4-9h21l5 9Z" fill="#d1edfa" />
        <rect x="5" y="27" width="54" height="23" rx="8" fill={paint} />
        <rect x="10" y="44" width="9" height="12" rx="4" fill="#244867" />
        <rect x="45" y="44" width="9" height="12" rx="4" fill="#244867" />
        <rect x="11" y="34" width="11" height="5" rx="2" fill="#fff4b0" />
        <rect x="42" y="34" width="11" height="5" rx="2" fill="#fff4b0" />
        <path
          d="M25 43h14"
          stroke="#13558d"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
    tasks: (
      <>
        <rect x="12" y="9" width="41" height="49" rx="7" fill={paint} />
        <rect x="18" y="16" width="29" height="35" rx="3" fill="#fff" />
        <rect x="24" y="5" width="17" height="14" rx="4" fill="#41bcc3" />
        <path
          d="m23 29 5 5 10-11m-15 17h19m-19 5h15"
          fill="none"
          stroke="#6dbbc7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    hobby: (
      <>
        <path
          d="M18 18h28c7 0 11 5 13 20s-2 20-9 13L40 42H24l-10 9C7 58 3 53 5 38s6-20 13-20"
          fill={paint}
        />
        <path
          d="M20 26v14m-7-7h14"
          stroke="#513f94"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="44" cy="29" r="3" fill="#d2c8ff" />
        <circle cx="50" cy="35" r="3" fill="#d2c8ff" />
        <path
          d="M22 19h21"
          stroke="#d7c9ff"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".6"
        />
      </>
    ),
    target: (
      <>
        <circle cx="30" cy="35" r="23" fill={paint} />
        <circle cx="30" cy="35" r="16" fill="#fff" />
        <circle cx="30" cy="35" r="10" fill={paint} />
        <circle cx="30" cy="35" r="4" fill="#fff" />
        <path
          d="m31 33 19-20m-1-8 1 9 9 1"
          fill="none"
          stroke="#745d95"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    coin: (
      <>
        <circle cx="32" cy="32" r="25" fill={paint} />
        <circle
          cx="32"
          cy="32"
          r="19"
          fill="none"
          stroke="#fff0a1"
          strokeWidth="3"
        />
        <path
          d="M36 20h-9c-10 5 0 10 6 11s10 10-1 12H23m9-27v32"
          fill="none"
          stroke="#e69e03"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    ),
    trophy: (
      <>
        <path d="M17 10h30v17c0 24-30 24-30 0Z" fill={paint} />
        <path
          d="M17 15H8v9q0 14 13 14m26-23h9v9q0 14-13 14"
          fill="none"
          stroke="#f6ba27"
          strokeWidth="5"
        />
        <path
          d="M32 41v11m-12 5h24"
          stroke="#ecac20"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M24 17v10"
          stroke="#fff0a3"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
    crown: (
      <>
        <path d="m10 20 11 12 11-20 11 20 11-12-6 33H16Z" fill={paint} />
        <circle cx="10" cy="18" r="4" fill="#ffcf47" />
        <circle cx="32" cy="10" r="4" fill="#ffcf47" />
        <circle cx="54" cy="18" r="4" fill="#ffcf47" />
        <path d="M18 47h28" stroke="#fff1a6" strokeWidth="3" />
        <circle cx="32" cy="38" r="4" fill="#2baff0" />
      </>
    ),
    fire: (
      <path
        d="M34 4c7 14-5 18 5 26 4-5 8-9 8-14 23 25 7 44-14 44C6 60 0 36 21 19c-2 10 0 15 4 18-1-14 7-19 9-33"
        fill={paint}
      />
    ),
  };
  return (
    <svg
      className={`game-art game-art-${kind}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {art[kind] ?? art.target}
    </svg>
  );
}
