import { BRAND_ASSET_ROOT } from '../brandAssets';
import { useMenuTheme } from '../menuTheme';

/** Логотип YOUR LIFE на прозрачном фоне; в тёмной теме надписи светлые. */
export default function BrandLogo({ size = 96, className = '', decorative = false }: {
  size?: number; className?: string; decorative?: boolean;
}) {
  const [theme] = useMenuTheme();
  const file = `logo-${size <= 48 ? 96 : 256}-${theme === 'dark' ? 'dark' : 'clear'}.png`;
  return <img
    className={`brand-logo ${className}`.trim()}
    src={`${import.meta.env.BASE_URL}${BRAND_ASSET_ROOT}${file}`}
    width={size} height={size}
    alt={decorative ? '' : 'PLAY YOUR LIFE — Твоя жизнь. Твоя игра.'}
    decoding="async" draggable={false}
  />;
}
