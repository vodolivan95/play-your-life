import { useRef, useState } from 'react';
import ProjectArt from './ProjectArt';
import { readProjectImage } from '../projectImage';
import './ProjectImagePicker.css';

export default function ProjectImagePicker({
  image,
  onChange,
  onBusy,
  sphere,
  banner = false,
}: {
  image?: string;
  onChange: (image?: string) => void;
  onBusy: (busy: boolean) => void;
  sphere: string;
  banner?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <fieldset className="project-image-picker">
      <legend>Картинка проекта</legend>
      <div className="project-image-picker-row">
        <ProjectArt name="Новый проект" sphere={sphere} image={image} />
        <div>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy
              ? 'Подготовка картинки…'
              : image
                ? 'Заменить картинку'
                : 'Выбрать картинку с телефона'}
          </button>
          {image && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                onChange(undefined);
                setError('');
              }}
            >
              Убрать картинку
            </button>
          )}
          <small>
            Выбери из галереи или файлов.{' '}
            {banner
              ? 'Обложка сохраняет пропорции изображения.'
              : 'Фото будет обрезано по центру в круг.'}
          </small>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        tabIndex={-1}
        className="sr-only"
        aria-label="Изображение проекта"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const current = ++request.current;
          setBusy(true);
          onBusy(true);
          setError('');
          try {
            const next = await readProjectImage(file, banner);
            if (request.current === current) onChange(next);
          } catch (err) {
            if (request.current === current)
              setError(
                err instanceof Error
                  ? err.message
                  : 'Не удалось загрузить картинку.',
              );
          } finally {
            if (request.current === current) {
              setBusy(false);
              onBusy(false);
            }
          }
        }}
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
