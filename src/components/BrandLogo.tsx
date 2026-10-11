import { BRAND_ASSET_ROOT } from '../brandAssets';

/** Эмблема «корона с горами» на прозрачном фоне — та же, что в значке вкладки и приложения. */
export default function BrandLogo({ size = 96, className = '', decorative = false }: {
  size?: number; className?: string; decorative?: boolean;
}) {
  const file = `logo-${size <= 48 ? 96 : 256}.png`;
  return <img
    className={`brand-logo ${className}`.trim()}
    src={`${import.meta.env.BASE_URL}${BRAND_ASSET_ROOT}${file}`}
    width={size} height={size}
    alt={decorative ? '' : 'PLAY YOUR LIFE'}
    decoding="async" draggable={false}
  />;
}
