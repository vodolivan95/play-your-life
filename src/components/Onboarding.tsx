import { useState } from 'react';
import type { FormEvent } from 'react';
import { avatars, personalState, spheres } from '../game';
import type { GameState, PlayerProfile } from '../game';
import Icon from './Icon';
import Avatar from './Avatar';

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="avatar-picker" role="group" aria-label="Выбор аватара">
      {avatars
        .filter((a) => a.icon !== 'character')
        .map((a) => (
          <button
            type="button"
            key={a.name}
            className={
              value === a.icon || (value === 'character' && a.icon === '🐼')
                ? 'selected'
                : ''
            }
            aria-label={a.name}
            aria-pressed={
              value === a.icon || (value === 'character' && a.icon === '🐼')
            }
            onClick={() => onChange(a.icon)}
          >
            <Avatar value={a.icon} />
          </button>
        ))}
    </div>
  );
}
export function ProfileEditor({
  profile,
  onSave,
  onStart,
}: {
  profile: PlayerProfile;

  onSave: (profile: PlayerProfile) => void;
  onStart: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ ...profile, name: name.trim(), avatar });
  }
  return (
    <form onSubmit={submit}>
      <div className="eyebrow">ТВОЙ ПЕРСОНАЖ</div>
      <h2>Личный профиль</h2>
      <p className="muted">
        {profile.mode === 'demo'
          ? 'Деморежим · Можно начать собственную игру.'
          : 'Твоя история. Твои достижения.'}
      </p>
      <label>
        Как тебя зовут?
        <input
          autoFocus
          required
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Твоё имя"
        />
      </label>
      <div className="field-label">Выбери аватар</div>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <button
        type="submit"
        disabled={!name.trim()}
        className="primary-button submit-button"
      >
        Сохранить профиль
      </button>
      {profile.mode === 'demo' && (
        <button
          type="button"
          className="secondary-button start-personal"
          onClick={onStart}
        >
          Начать свою игру с нуля <Icon name="arrow" size={16} />
        </button>
      )}
    </form>
  );
}
export default function Onboarding({
  profile,
  onComplete,
  onDemo,
  accountMode = false,
}: {
  profile: PlayerProfile;
  accountMode?: boolean;
  onComplete: (state: GameState) => void;
  onDemo: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(
    profile.name === 'Игрок' ? '' : profile.name,
  );
  const [avatar, setAvatar] = useState(profile.avatar);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(spheres.map((s) => [s.id, 5])),
  );
  const [goalName, setGoalName] = useState('');
  const [goalSphere, setGoalSphere] = useState('english');
  const [target, setTarget] = useState('100');
  const [error, setError] = useState('');
  function next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (step === 1 && !name.trim()) {
      setError('Укажи своё имя.');
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    try {
      onComplete(
        personalState({ name, avatar }, scores, {
          name: goalName,
          sphere: goalSphere,
          target: Number(target),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь данные.');
    }
  }
  if (step === 0)
    return (
      <div className="welcome">
        <span className="welcome-art">
          <Avatar value={avatar} />
          <i>✦</i>
          <b>✧</b>
        </span>
        <div className="eyebrow">YOUR LIFE. YOUR GAME.</div>
        <h2>В центре игры — ты.</h2>
        <p>
          Преврати реальные действия в прогресс.
          <br />
          Твой персонаж развивается вместе с тобой.
        </p>
        <div className="welcome-features">
          <span>⚡ Квесты и XP</span>
          <span>🌱 9 сфер жизни</span>
          <span>🎯 Твои цели</span>
        </div>
        <button
          className="primary-button submit-button"
          onClick={() => setStep(1)}
        >
          Начать мою игру <Icon name="arrow" size={17} />
        </button>
        <button className="secondary-button" onClick={onDemo}>
          {profile.onboardingComplete
            ? 'Вернуться к текущей игре'
            : accountMode ? 'Настроить позже' : 'Сначала посмотреть демо'}
        </button>
        <small>{accountMode ? 'Твоя новая игра начинается с 0 XP. Прогресс сохраняется в аккаунте.' : 'Без регистрации. Прогресс сохраняется на этом устройстве.'}</small>
      </div>
    );
  return (
    <form onSubmit={next} className="onboarding-form">
      <div
        className="onboarding-steps"
        role="group"
        aria-label={`Шаг ${step} из 3`}
      >
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= step ? 'active' : ''} />
        ))}
      </div>
      <div className="eyebrow">ШАГ {step} ИЗ 3</div>
      <h2>
        {step === 1
          ? 'Познакомимся?'
          : step === 2
            ? 'Твоя точка старта'
            : 'К чему ты идёшь?'}
      </h2>
      <p className="muted">
        {step === 1
          ? 'Выбери имя и своего персонажа.'
          : step === 2
            ? 'Оцени каждую сферу так, как чувствуешь сейчас.'
            : 'Выбери одну цель, которая важна именно тебе.'}
      </p>
      {step === 1 && (
        <>
          <label>
            Как тебя зовут?
            <input
              autoFocus
              name="player-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
              placeholder="Твоё имя"
            />
          </label>
          <div className="field-label">Выбери аватар</div>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </>
      )}
      {step === 2 && (
        <>
          <div className="baseline-list">
            {spheres.map((s) => (
              <label className="baseline-row" key={s.id}>
                <div>
                  <span>
                    {s.icon} {s.name}
                  </span>
                  <b>
                    {scores[s.id]}
                    <small>/9</small>
                  </b>
                </div>
                <input
                  type="range"
                  aria-label={`Начальная оценка: ${s.name}`}
                  min="0"
                  max="9"
                  value={scores[s.id]}
                  onChange={(e) =>
                    setScores((previous) => ({
                      ...previous,
                      [s.id]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <p className="score-note">
            0 — сфера отсутствует · 5 — базовый уровень · 9 — твой личный
            стандарт. Начальная оценка не приносит XP.
          </p>
        </>
      )}
      {step === 3 && (
        <>
          <label>
            Главная цель
            <input
              autoFocus
              required
              maxLength={100}
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="Например, пробежать 10 километров"
            />
          </label>
          <label>
            Сфера жизни
            <select
              aria-label="Сфера жизни"
              value={goalSphere}
              onChange={(e) => setGoalSphere(e.target.value)}
            >
              {spheres.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Целевое значение
            <input
              type="number"
              min="1"
              max="1000000"
              step="1"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <p className="score-note">
            Если цель сложно измерить, используй 100: каждое значение будет
            процентом. За достижение — 200 XP.
          </p>
          <div className="start-summary">
            <span>
              <Avatar value={avatar} />
            </span>
            <div>
              <strong>{name.trim()}, твоё приключение начинается!</strong>
              <small>Уровень 1 · 0 XP · Прогресс цели 0%</small>
            </div>
          </div>
          {profile.onboardingComplete && (
            <label className="reset-consent">
              <input type="checkbox" required />
              Начать с нуля. Текущие демо-квесты, XP, цели и история будут
              заменены моей новой игрой.
            </label>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="onboarding-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => setStep(step - 1)}
        >
          ← Назад
        </button>
        <button className="primary-button" type="submit">
          {step === 3 ? 'Начать играть' : 'Продолжить'}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </form>
  );
}


