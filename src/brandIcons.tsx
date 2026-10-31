import { matchBrand } from './brands';

/** Иконка бренда как SVG по названию платежа. Рендерит null, если логотипа нет. */
export default function BrandIcon({ name, size = 19 }: { name: string; size?: number }) {
  const brand = matchBrand(name);
  if (!brand) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${brand.hex}`}
      role="img"
      aria-label={brand.title}
    >
      <path d={brand.path} />
    </svg>
  );
}
