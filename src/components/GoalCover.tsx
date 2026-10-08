import { useEffect, useRef, useState } from "react";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import type { Goal, GoalCover as Cover } from "../game";
import { auth } from "../firebaseClient";
import { coverSource } from "../goalCoverSource";
export function GoalBanner({
  goal,
  children,
  onEdit,
}: {
  goal: Goal;
  children: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <section className="goal-live-banner">
      <img
        alt="Обложка цели"
        src={coverSource(goal)}
        style={{
          objectPosition: `${goal.cover?.x ?? 50}% ${goal.cover?.y ?? 50}%`,
          transform: `scale(${goal.cover?.scale ?? 1})`,
        }}
      />
      <div className="goal-banner-content">{children}</div>
      {onEdit && (
        <button
          className="icon-button goal-cover-edit"
          aria-label="Редактировать обложку"
          onClick={onEdit}
        >
          ✎
        </button>
      )}
    </section>
  );
}
export default function GoalCoverEditor({
  goal,
  goals,
  ownerId,
  onSave,
  onClose,
}: {
  goal: Goal;
  goals: Goal[];
  ownerId?: string;
  onSave: (cover?: Cover, clearLegacy?: boolean) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState(goal.cover?.url ?? goal.image);
  const [meta, setMeta] = useState({
    width: goal.cover?.width ?? 0,
    height: goal.cover?.height ?? 0,
  });
  const [x, setX] = useState(goal.cover?.x ?? 50),
    [y, setY] = useState(goal.cover?.y ?? 50),
    [scale, setScale] = useState(goal.cover?.scale ?? 1);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const available =
    import.meta.env.VITE_GOAL_STORAGE_ENABLED === "true" &&
    !!ownerId &&
    auth.currentUser?.uid === ownerId;
  async function choose(next?: File) {
    if (!next) return;
    const version = ++request.current;
    setError("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
        next.size > 20 * 1024 * 1024
      )
        throw new Error("JPG, PNG или WebP — до 20 МБ.");
      const url = URL.createObjectURL(next),
        image = new Image();
      image.src = url;
      try {
        await image.decode();
        if (image.naturalWidth * image.naturalHeight > 40000000)
          throw new Error("Максимум 40 мегапикселей.");
        if (request.current !== version) {
          URL.revokeObjectURL(url);
          return;
        }
        setFile(next);
        setMeta({ width: image.naturalWidth, height: image.naturalHeight });
        setPreview((old) => {
          if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
          return url;
        });
        setX(50);
        setY(50);
        setScale(1);
      } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      let cover = goal.cover;
      if (file) {
        if (!available)
          throw new Error(
            "Постоянное файловое хранилище не подтверждено. Предпросмотр не сохранён.",
          );
        const path = `players/${ownerId}/goals/${goal.id}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
        const location = ref(getStorage(auth.app), path);
        await uploadBytes(location, file, {
          contentType: file.type,
          cacheControl: "public,max-age=31536000,immutable",
        });
        cover = {
          url: await getDownloadURL(location),
          path,
          name: file.name,
          ...meta,
          size: file.size,
          x,
          y,
          scale,
          uploadedAt: new Date().toISOString(),
        };
      }
      if (!cover)
        throw new Error(
          "Сначала загрузите изображение в постоянное хранилище.",
        );
      onSave({ ...cover, x, y, scale });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Файл не сохранён.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="planning-form goal-cover-editor">
      <h2>Обложка цели</h2>
      {!available && (
        <p role="status">
          Постоянное файловое хранилище не подтверждено. Можно проверить
          кадрирование, но новый файл не будет сохранён. Тариф Firebase не
          меняется.
        </p>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <div className="goal-cover-buttons">
        <button onClick={() => input.current?.click()}>
          Загрузить / заменить изображение
        </button>
        <label>
          Ранее загруженное
          <select
            value=""
            onChange={(e) => {
              const chosen = goals.find((g) => g.id === e.target.value)?.cover;
              if (chosen) {
                onSave({ ...chosen });
                onClose();
              }
            }}
          >
            <option value="">Выбрать…</option>
            {goals
              .filter((g) => g.cover)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {preview && (
        <div className="goal-crop-preview">
          <img
            src={preview}
            alt="Предпросмотр кадрирования"
            style={{
              objectPosition: `${x}% ${y}%`,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      )}
      <label>
        Масштаб
        <input
          aria-label="Масштаб обложки"
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
        />
      </label>
      <label>
        По горизонтали
        <input
          type="range"
          min="0"
          max="100"
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
        />
      </label>
      <label>
        По вертикали
        <input
          type="range"
          min="0"
          max="100"
          value={y}
          onChange={(e) => setY(Number(e.target.value))}
        />
      </label>
      <p>
        Исходные пропорции и байты файла сохраняются. Кадрирование применяется к
        одному изображению во всех страницах цели.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary-button"
        disabled={busy || (!goal.cover && !available)}
        onClick={() => void save()}
      >
        {busy ? "Сохранение файла…" : "Сохранить кадрирование"}
      </button>
      <button
        onClick={() => {
          onSave(undefined, true);
          onClose();
        }}
      >
        Удалить / вернуть стандартную обложку
      </button>
      <button
        onClick={() => {
          if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
          onClose();
        }}
      >
        Отмена
      </button>
    </div>
  );
}
