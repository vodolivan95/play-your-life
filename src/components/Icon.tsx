export default function Icon({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  const paths: Record<string, React.ReactNode> = {
    copy: <><rect x="8" y="7" width="12" height="14" rx="2"/><path d="M16 7V3H4v14h4"/></>,
    link: <><path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/></>,
    layers: <><path d="m12 2 10 6-10 6L2 8zM2 13l10 6 10-6M2 18l10 6 10-6"/></>,
    play: <><circle cx="12" cy="12" r="10"/><path d="m9 7 8 5-8 5z"/></>,
    city: (
      <>
        <path d="M3 21V10h5v11M8 21V3h8v18M16 21V8h5v13M2 21h20M10 7h4M10 11h4M10 15h4M5 13v2M18 11v2" />
      </>
    ),
    shop: (
      <>
        <path d="M5 8h14l1 13H4zM8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M5 21v-3a7 7 0 0 1 14 0v3z" />
      </>
    ),
    statistics: (
      <>
        <path d="M4 21V12h4v9M10 21V7h4v14M16 21V3h4v18" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    quests: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="3" />
        <path d="M9 4V2h6v2M9 10l2 2 4-4M9 16h6" />
      </>
    ),
    spheres: (
      <>
        <circle cx="7" cy="7" r="4" />
        <circle cx="17" cy="7" r="4" />
        <circle cx="7" cy="17" r="4" />
        <circle cx="17" cy="17" r="4" />
      </>
    ),
    goals: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    tree: (
      <>
        <circle cx="12" cy="4" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M12 6v5H5v6m7-6h7v6" />
      </>
    ),
    trophy: (
      <>
        <path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10" />
      </>
    ),
    plan: (
      <>
        <path d="M4 5h16M4 12h10M4 19h7" />
        <circle cx="18" cy="17" r="4" />
        <path d="M18 15v2l2 1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 10h18m-13 5h1m3 0h1m3 0h1M8 18h1m3 0h1" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    back: <path d="m15 5-7 7 7 7" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    trash: (
      <>
        <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
      </>
    ),
    bell: (
      <>
        <path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 21h4" />
      </>
    ),
    bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
    pencil: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    chat: (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
    flag: <path d="M5 3v18M5 4h13l-3 4 3 4H5" />,
    gauge: (
      <>
        <path d="M4 16a8 8 0 1 1 16 0" />
        <path d="M12 16 16.2 9.8" />
        <circle cx="12" cy="16" r="1" />
      </>
    ),
    heart: (
      <path d="M12 20s-7-4.4-9.3-8.8C1.2 8 2.6 4.8 5.8 4.2 7.9 3.8 10 4.8 12 7c2-2.2 4.1-3.2 6.2-2.8 3.2.6 4.6 3.8 3.1 7C19 15.6 12 20 12 20z" />
    ),
    diamond: <path d="M12 2 22 12 12 22 2 12z" />,
    ruler: (
      <>
        <rect x="3" y="9" width="18" height="6" rx="1.4" />
        <path d="M7.5 9v3M11.5 9v3M15.5 9v3" />
      </>
    ),
    paperclip: <path d="M8 13.5V7a4 4 0 1 1 8 0v8.5a2.5 2.5 0 1 1-5 0V8" />,
    crosshair: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      </>
    ),
    brain: (
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.2 11.1c.5.3.7.8.7 1.4h5c0-.6.2-1.1.7-1.4A6 6 0 0 0 12 3z" />
    ),
    flow: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M8 6h4a4 4 0 0 1 4 4M8 18h4a4 4 0 0 0 4-4" />
      </>
    ),
    star: (
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />
    ),
    repeat: (
      <>
        <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
        <path d="M18 3v4h-4M6 21v-4h4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.goals}
    </svg>
  );
}
