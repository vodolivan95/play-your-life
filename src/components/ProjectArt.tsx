import { useId } from 'react';
import GameArt from './GameArt';

import { projectStyle } from './projectStyle';

export default function ProjectArt({
  name,
  sphere,
  image,
}: {
  name: string;
  sphere: string;
  image?: string;
}) {
  const id = useId().replace(/:/g, '');
  const { kind, color } = projectStyle(name, sphere);
  if (image)
    return (
      <span className="project-art project-photo">
        <img src={image} alt="" />
      </span>
    );
  const art: Record<string, React.ReactNode> = {
    smoking: (
      <>
        <path d="M19 34h27v8H19z" fill="#fff9ea" />
        <path d="M40 34h6v8h-6" fill="#ad643e" />
        <path
          d="M25 28c-6-5 5-6 0-12m8 12c-6-5 5-6 0-12"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          opacity=".7"
        />
        <circle
          cx="32"
          cy="32"
          r="21"
          fill="none"
          stroke="#a33945"
          strokeWidth="5"
        />
        <path
          d="M17 17l30 30"
          stroke="#a33945"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </>
    ),
    tooth: (
      <>
        <path
          d="M17 17c8-7 11 0 15 0s10-7 16 0c8 9-1 16-3 26-1 9-7 10-9 0-2-8-6-8-8 0-2 10-8 9-9 0-2-10-10-17-2-26Z"
          fill="#fff"
        />
        <path
          d="M21 20q3-3 6-1"
          fill="none"
          stroke="#d8f8ff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
    sleep: (
      <>
        <path d="M13 25h38v20H13Z" fill="#493e9c" />
        <path
          d="M13 19v29m38-17v17"
          stroke="#493e9c"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <rect x="18" y="23" width="12" height="8" rx="3" fill="#fff" />
        <path d="M33 25h12q5 0 5 9H14v-3h19Z" fill="#ddd0ff" />
        <path d="M39 11h8l-8 8h8" fill="none" stroke="#fff" strokeWidth="2" />
      </>
    ),
    food: (
      <>
        <path
          d="M32 23c-18-11-25 10-15 24 7 10 11 5 15 5s9 5 16-5c10-14 3-35-16-24Z"
          fill="#e94b55"
        />
        <path
          d="M32 23q-3-8 1-13"
          stroke="#795b3d"
          strokeWidth="3"
          fill="none"
        />
        <path d="M34 18q1-11 13-9-1 11-13 9" fill="#68af65" />
        <path
          d="M19 29q-4 5-2 10"
          stroke="#ffa3a0"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
    water: (
      <>
        <path
          d="M32 10C27 22 15 33 19 43c4 13 23 13 27 0 4-10-9-21-14-33Z"
          fill="#008bcf"
        />
        <path
          d="M27 30q-8 12 0 15"
          stroke="#81e4ff"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
    sport: (
      <>
        <path d="M13 32h38" stroke="#126e65" strokeWidth="7" />
        <path
          d="M19 23v18m26-18v18"
          stroke="#126e65"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M12 28v9m40-9v9"
          stroke="#126e65"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </>
    ),
    medical: (
      <>
        <rect x="17" y="19" width="30" height="29" rx="7" fill="#fff" />
        <path d="M25 19v-5h14v5" stroke="#fff" strokeWidth="4" fill="none" />
        <path d="M32 26v15m-7-7h14" stroke={color} strokeWidth="5" />
      </>
    ),
  };
  return (
    <span className="project-art" style={{ background: `${color}20` }}>
      {art[kind] ? (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <radialGradient id={id} cx=".3" cy=".2" r=".85">
              <stop stopColor="#fff" stopOpacity=".65" />
              <stop offset=".48" stopColor={color} stopOpacity=".45" />
              <stop offset="1" stopColor={color} />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="29" fill={`url(#${id})`} />
          {art[kind]}
        </svg>
      ) : (
        <GameArt kind={kind} />
      )}
    </span>
  );
}
