import { BRAND_ASSET_ROOT } from '../brandAssets';

export default function BrandLogo({ size = 96, className = '', decorative = false }: {
  size?: number; className?: string; decorative?: boolean;
}) {
  return <img
    className={`brand-logo ${className}`.trim()}
    src={`${import.meta.env.BASE_URL}${BRAND_ASSET_ROOT}${size <= 48 ? 'logo-96.png' : 'logo-256.png'}`}
    width={size} height={size}
    alt={decorative ? '' : 'PLAY YOUR LIFE — Твоя жизнь. Твоя игра.'}
    decoding="async" draggable={false}
  />;
}
