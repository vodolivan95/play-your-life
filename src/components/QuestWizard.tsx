import { useEffect, useRef, useState } from "react";
import { difficulties, spheres } from "../game";
import type { Quest } from "../game";
import { habitIcons, virtualRewards } from "../personalQuests";
import type { Habit } from "../personalQuests";
import { SphereBuilding } from "./SphereCity";
import GameArt from "./GameArt";
import { inspectQuestPhoto } from "../questPhoto";

type Draft = {
  name: string;
  notes: string;
  sphere: string;
  difficulty: string;
  targetValue: number;
  unit: string;
  rewardCoins: number;
  virtualRewardId: string;
  startsAt: string;
  dueAt: string;
  priority: "low" | "normal" | "high";
  iconId: string;
  weekdays: number[];
};
const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export default function QuestWizard({
  quest,
  habit,
  habitMode = false,
  initial,
  onClose,
  onQuest,
  onHabit,
}: {
  quest?: Quest;
  habit?: Habit;
  habitMode?: boolean;
  initial?: Partial<Quest>;
  onClose: () => void;
  onQuest: (
    q: Partial<Quest> & Pick<Quest, "name" | "sphere" | "difficulty">,
  ) => void;
  onHabit: (
    h: Pick<
      Habit,
      | "title"
      | "sphere"
      | "iconId"
      | "targetValue"
      | "unit"
      | "weekdays"
      | "rewardCoins"
    > &
      Partial<Habit>,
  ) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [photo, setPhoto] = useState("");
  const base = quest ?? initial;
  const [draft, setDraft] = useState<Draft>({
    name: habit?.title ?? base?.name ?? "",
    notes: base?.notes ?? "",
    sphere: habit?.sphere ?? base?.sphere ?? "health",
    difficulty: base?.difficulty ?? "Simple",
    targetValue: habit?.targetValue ?? base?.targetValue ?? 1,
    unit: habit?.unit ?? base?.unit ?? "",
    rewardCoins: habit?.rewardCoins ?? base?.rewardCoins ?? 0,
    virtualRewardId: base?.virtualRewardId ?? "",
    startsAt: base?.startsAt?.slice(0, 10) ?? "",
    dueAt: base?.dueAt?.slice(0, 10) ?? "",
    priority: base?.priority ?? "normal",
    iconId: habit?.iconId ?? "water",
    weekdays: habit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
  });
  const [coverImage, setCoverImage] = useState(quest?.coverImage);
  const locked =
    habit?.rewardLocked ||
    quest?.rewardLocked ||
    (quest?.currentValue ?? 0) > 0;
  const labels = habitMode
    ? [
        "Что хочешь делать?",
        "Сфера и иконка",
        "Цель и повторение",
        "Мини-награда",
        "Проверка",
      ]
    : [
        "Что хочешь сделать?",
        "Сфера жизни",
        "Фотография",
        "Цель",
        "Награда",
        "Проверка",
      ];
  useEffect(() => {
    dialog.current?.showModal();
    const el = dialog.current;
    return () => el?.close();
  }, []);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );
  function field<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  }
  function validate() {
    if (step === 0 && !draft.name.trim()) throw new Error("Добавь название.");
    if (
      (habitMode ? step === 2 : step === 3) &&
      (!Number.isFinite(draft.targetValue) ||
        draft.targetValue <= 0 ||
        draft.targetValue > 1000000)
    )
      throw new Error("Проверь цель: от 0 до 1 000 000, больше нуля.");
    if (habitMode && step === 2 && !draft.weekdays.length)
      throw new Error("Выбери хотя бы один день.");
    if (
      (habitMode ? step === 3 : step === 4) &&
      (!Number.isSafeInteger(draft.rewardCoins) ||
        draft.rewardCoins < 0 ||
        draft.rewardCoins > (habitMode ? 10 : 100))
    )
      throw new Error(`Награда: от 0 до ${habitMode ? 10 : 100} целых монет.`);
    if (draft.dueAt && draft.startsAt && draft.dueAt < draft.startsAt)
      throw new Error("Дедлайн раньше начала.");
  }
  async function choose(file?: File) {
    if (!file) return;
    try {
      await inspectQuestPhoto(file);
      const url = URL.createObjectURL(file),
        image = new Image();
      image.src = url;
      try {
        await image.decode();
        if (
          !image.naturalWidth ||
          image.naturalWidth * image.naturalHeight > 40000000
        )
          throw new Error(
            "Изображение слишком большое: максимум 40 мегапикселей.",
          );
        setPhoto(url);
      } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function advance() {
    try {
      validate();
      if (step < labels.length - 1) {
        setStep(step + 1);
        return;
      }
      if (habitMode)
        onHabit({
          ...habit,
          title: draft.name,
          sphere: draft.sphere,
          iconId: draft.iconId,
          targetValue: draft.targetValue,
          unit: draft.unit,
          weekdays: draft.weekdays,
          rewardCoins: draft.rewardCoins,
        });
      else
        onQuest({
          ...quest,
          name: draft.name,
          notes: draft.notes,
          sphere: draft.sphere,
          difficulty: draft.difficulty,
          targetValue: draft.targetValue,
          unit: draft.unit,
          rewardCoins: draft.rewardCoins,
          virtualRewardId: draft.virtualRewardId,
          startsAt: draft.startsAt,
          dueAt: draft.dueAt,
          priority: draft.priority,
          coverImage,
        });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <dialog
      className="pyl-quest-dialog"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="quest-wizard-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          advance();
        }}
      >
        <div className="pyl-dialog-top">
          <span>
            ШАГ {step + 1} / {labels.length}
          </span>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <h2 id="quest-wizard-title">
          {habitMode
            ? habit
              ? "Изменить привычку"
              : "Добавить привычку"
            : quest
              ? "Изменить квест"
              : "Создать квест"}
        </h2>
        <h3>{labels[step]}</h3>
        <div className="pyl-meter">
          <span style={{ width: `${((step + 1) / labels.length) * 100}%` }} />
        </div>
        {step === 0 && (
          <>
            <label>
              Название *
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => field("name", e.target.value)}
                maxLength={100}
                required
                placeholder={
                  habitMode ? "Выпить 2 литра воды" : "Пробежать 10 км"
                }
              />
            </label>
            {!habitMode && (
              <label>
                Описание
                <textarea
                  value={draft.notes}
                  onChange={(e) => field("notes", e.target.value)}
                  maxLength={2000}
                  placeholder="Почему это важно для тебя?"
                />
              </label>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <div className="pyl-sphere-picker">
              {spheres.map((s) => (
                <button
                  key={s.id}
                  aria-label={s.name}
                  type="button"
                  disabled={!!locked}
                  className={draft.sphere === s.id ? "selected" : ""}
                  aria-pressed={draft.sphere === s.id}
                  onClick={() => field("sphere", s.id)}
                >
                  <SphereBuilding id={s.id} />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
            {locked && <p>Сфера зафиксирована после начала выполнения.</p>}
            {habitMode && (
              <fieldset>
                <legend>Игровая иконка *</legend>
                <div className="pyl-icon-picker">
                  {habitIcons.map(([id, icon, name]) => (
                    <button
                      key={id}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={draft.iconId === id}
                      className={draft.iconId === id ? "selected" : ""}
                      onClick={() => field("iconId", id)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}
        {!habitMode && step === 2 && (
          <>
            <div className="pyl-photo-preview">
              {photo || coverImage ? (
                <img src={photo || coverImage} alt="Предпросмотр обложки" />
              ) : (
                <SphereBuilding id={draft.sphere} />
              )}
            </div>
            <label className="pyl-upload">
              Выбрать изображение
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {(photo || coverImage) && (
              <button
                type="button"
                onClick={() => {
                  setPhoto("");
                  setCoverImage(undefined);
                }}
              >
                Удалить изображение
              </button>
            )}
            <p className="pyl-help">
              JPG, PNG, WEBP · до 5 МБ. Предпросмотр подогнан под карточку.
              Постоянное облачное хранение пока недоступно: выбранная фотография
              не сохраняется, карточка получит изображение сферы.
            </p>
          </>
        )}
        {(habitMode ? step === 2 : step === 3) && (
          <>
            <div className="pyl-form-grid">
              <label>
                Цель / количество *
                <input
                  type="number"
                  value={draft.targetValue}
                  min="0.001"
                  max="1000000"
                  step="any"
                  required
                  onChange={(e) => field("targetValue", e.target.valueAsNumber)}
                />
              </label>
              <label>
                Единица измерения
                <input
                  value={draft.unit}
                  maxLength={30}
                  onChange={(e) => field("unit", e.target.value)}
                  placeholder={habitMode ? "литра" : "км"}
                />
              </label>
            </div>
            {habitMode ? (
              <fieldset>
                <legend>Дни повторения</legend>
                <div className="pyl-icon-picker">
                  {days.map((name, day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={draft.weekdays.includes(day)}
                      className={draft.weekdays.includes(day) ? "selected" : ""}
                      onClick={() =>
                        field(
                          "weekdays",
                          draft.weekdays.includes(day)
                            ? draft.weekdays.filter((d) => d !== day)
                            : [...draft.weekdays, day],
                        )
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <div className="pyl-form-grid">
                  <label>
                    Дата начала
                    <input
                      type="date"
                      value={draft.startsAt}
                      onChange={(e) => field("startsAt", e.target.value)}
                    />
                  </label>
                  <label>
                    Дедлайн
                    <input
                      type="date"
                      value={draft.dueAt}
                      min={draft.startsAt}
                      onChange={(e) => field("dueAt", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Важность
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      field("priority", e.target.value as Draft["priority"])
                    }
                  >
                    <option value="normal">Обычная</option>
                    <option value="high">Важная</option>
                    <option value="low">Низкая</option>
                  </select>
                </label>
              </>
            )}
          </>
        )}
        {(habitMode ? step === 3 : step === 4) && (
          <>
            <label>
              Life Coins · 0–{habitMode ? 10 : 100}
              <input
                type="number"
                min="0"
                max={habitMode ? 10 : 100}
                step="1"
                value={draft.rewardCoins}
                disabled={!!locked}
                onChange={(e) => field("rewardCoins", e.target.valueAsNumber)}
                required
              />
            </label>
            {locked && (
              <p className="pyl-help">
                Награда зафиксирована после первого прогресса.
              </p>
            )}
            {!habitMode && (
              <>
                <label>
                  Сложность
                  <select
                    value={draft.difficulty}
                    disabled={!!locked}
                    onChange={(e) => field("difficulty", e.target.value)}
                  >
                    {Object.entries(difficulties).map(([d, xp]) => (
                      <option key={d} value={d}>
                        {
                          (
                            {
                              Micro: "Мини",
                              Simple: "Простой",
                              Medium: "Обычный",
                              Hard: "Сложный",
                              "Very Hard": "Очень сложный",
                            } as Record<string, string>
                          )[d]
                        }{" "}
                        · {xp} XP
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Виртуальная награда
                  <select
                    value={draft.virtualRewardId}
                    disabled={!!locked}
                    onChange={(e) => field("virtualRewardId", e.target.value)}
                  >
                    <option value="">Без предмета</option>
                    {virtualRewards.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.icon} {i.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="pyl-reward-preview">
              <GameArt kind="coin" /> +{draft.rewardCoins} Life Coins{" "}
              <strong>
                ✦ +
                {habitMode
                  ? 5
                  : difficulties[
                      draft.difficulty as keyof typeof difficulties
                    ]}{" "}
                XP
              </strong>
            </div>
            <p className="pyl-help">XP определяет игровая система.</p>
          </>
        )}
        {step === labels.length - 1 && (
          <div className="pyl-wizard-review">
            <strong>{draft.name}</strong>
            <p>
              {spheres.find((s) => s.id === draft.sphere)?.name} ·{" "}
              {draft.targetValue} {draft.unit}
            </p>
            <p>{draft.notes}</p>
            <b>
              🪙 {draft.rewardCoins} · ✦{" "}
              {habitMode
                ? 5
                : difficulties[
                    draft.difficulty as keyof typeof difficulties
                  ]}{" "}
              XP
            </b>
            {draft.virtualRewardId && (
              <p>
                {
                  virtualRewards.find((i) => i.id === draft.virtualRewardId)
                    ?.icon
                }{" "}
                {
                  virtualRewards.find((i) => i.id === draft.virtualRewardId)
                    ?.name
                }
              </p>
            )}
            {habitMode && (
              <p>Повторение: {draft.weekdays.map((d) => days[d]).join(", ")}</p>
            )}
            {(photo || coverImage) && (
              <p className="pyl-help">
                Фотография показана только в предпросмотре. Обложка карточки —
                здание выбранной сферы.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="pyl-error">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="secondary-button"
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step ? "Назад" : "Отмена"}
          </button>
          <button className="primary-button" type="submit">
            {step === labels.length - 1
              ? quest || habit
                ? "Сохранить"
                : habitMode
                  ? "Создать привычку"
                  : "Создать квест"
              : "Далее →"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
