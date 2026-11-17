import { useId } from 'react';

const palette: Record<string, [string, string, string, string]> = {
  yellow: ['#d38a00', '#ffe75c', '#ffbc14', '#9b5000'], blue: ['#075a98', '#36b3ed', '#0872c7', '#003d69'],
  teal: ['#00666b', '#39bab1', '#087b7c', '#004448'], orange: ['#b85100', '#ffb04e', '#f47913', '#713200'],
  gray: ['#6c7883', '#d4dce2', '#99a9b5', '#34424f'], purple: ['#6848a0', '#c3a8f8', '#9673d5', '#412c6e'], green: ['#398a42', '#a6dc8e', '#66b45f', '#205929'],
};
export default function OneDriveFolder({ count, color = 'yellow' }: { count?: number; color?: string }) {
  const id = useId(), [edge, light, front, ink] = palette[color] || palette.yellow;
  return <svg className="od-folder" viewBox="0 0 180 152" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2=".7" y2="1"><stop stopColor={light} /><stop offset="1" stopColor={front} /></linearGradient></defs>
    <path fill={edge} d="M4 27C4 14 14 5 27 5h25c7 0 10 3 16 8l13 12h72c15 0 24 10 24 25v74c0 15-10 24-25 24H29c-15 0-25-10-25-25Z" />
    <path fill="#fff" d="M10 51c0-15 9-23 24-23h114c15 0 23 8 23 23v79H10Z" />
    <path fill={`url(#${id})`} stroke={edge} strokeWidth="3.5" d="M7 64c0-14 9-22 23-22h26c12 0 12-14 30-14h66c15 0 23 10 23 25v71c0 15-9 23-24 23H30c-15 0-23-9-23-23Z" />
    {count !== undefined && <text x="18" y="130" fill={ink} fontSize="28" fontFamily="inherit" fontWeight="400">{count}</text>}
  </svg>;
}
