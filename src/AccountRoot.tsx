import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import App from './App';
import { auth } from './firebaseClient';
import { firebaseSave } from './firebaseSave';
import { AccountSave } from './accountPersistence';
import type { SaveSnapshot } from './accountPersistence';
import { newAccountGame } from './accountGame';
import { backupText } from './backup';
import type { GameState } from './game';
import './account.css';

function errorText(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found')
  )
    return 'Проверьте почту и пароль.';
  if (code.includes('email-already-in-use'))
    return 'Эта почта уже зарегистрирована. Войдите или восстановите пароль.';
  if (code.includes('invalid-email')) return 'Укажите корректный адрес почты.';
  if (code.includes('weak-password')) return 'Выберите более надёжный пароль.';
  if (code.includes('operation-not-allowed'))
    return 'Регистрация ещё не включена в настройках Firebase.';
  if (code.includes('too-many-requests'))
    return 'Слишком много попыток. Попробуйте позже.';
  if (code.includes('network-request-failed'))
    return 'Нет связи с сервером. Проверьте интернет.';
  return 'Не удалось выполнить действие. Попробуйте снова.';
}
function download(state: GameState, name: string) {
  const url = URL.createObjectURL(
    new Blob([backupText(state)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Login({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState(''),
    [name, setName] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    if (mode === 'register' && (password !== repeat || !name.trim())) {
      setMessage('Укажите имя и проверьте совпадение паролей.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage(
          'Если аккаунт существует, на почту придёт ссылка для смены пароля.',
        );
      } else if (mode === 'login')
        await signInWithEmailAndPassword(auth, email.trim(), password);
      else {
        const result = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        await updateProfile(result.user, { displayName: name.trim() });
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-screen">
      <section className="account-card">
        <div className="eyebrow">PLAY YOUR LIFE</div>
        <h1>
          {mode === 'register'
            ? 'Начни свою игру'
            : mode === 'reset'
              ? 'Восстановить пароль'
              : 'Войти в свою игру'}
        </h1>
        <p>
          Твои квесты, проекты и прогресс — в одном аккаунте на телефоне и
          компьютере.
        </p>
        <div className="account-tabs">
          <button
            disabled={busy}
            onClick={() => {
              setMode('login');
              setMessage('');
            }}
          >
            Вход
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setMode('register');
              setMessage('');
            }}
          >
            Регистрация
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Имя
              <input
                required
                maxLength={30}
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Почта
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'reset' && (
            <label>
              Пароль
              <input
                required
                type="password"
                minLength={mode === 'register' ? 10 : 1}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {mode === 'register' && (
            <>
              <small>Не менее 10 символов. Новая игра начинается с 0 XP.</small>
              <label>
                Повторите пароль
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </label>
            </>
          )}
          {message && <p role="status">{message}</p>}
          <button disabled={busy} className="primary-button" type="submit">
            {busy
              ? 'Подождите…'
              : mode === 'register'
                ? 'Создать аккаунт'
                : mode === 'reset'
                  ? 'Отправить ссылку'
                  : 'Войти'}
          </button>
        </form>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setMode('reset');
            setMessage('');
          }}
        >
          Забыли пароль?
        </button>
        <button className="secondary-button" disabled={busy} onClick={onGuest}>
          Продолжить игру на этом устройстве
        </button>
        <small>
          Игра на устройстве остаётся отдельной. Она не переносится в новый
          аккаунт автоматически.
        </small>
      </section>
    </div>
  );
}
function CloudGame({ user }: { user: User }) {
  const [unit, setUnit] = useState<{
    engine: AccountSave;
    snapshot: SaveSnapshot;
  } | null>(null);
  const [message, setMessage] = useState(''),
    [leaving, setLeaving] = useState(false),
    [backup, setBackup] = useState(false);
  useEffect(() => {
    const engine = new AccountSave(
      user.uid,
      firebaseSave(user.uid),
      localStorage,
    );
    const unsubscribe = engine.subscribe((snapshot) =>
      setUnit({ engine, snapshot }),
    );
    const start = () =>
      engine.start(() =>
        newAccountGame(
          user.displayName || user.email?.split('@')[0] || 'Игрок',
        ),
      );
    void start();
    const sync = () => {
      if (document.visibilityState !== 'hidden') void engine.flush();
    };
    const timer = setInterval(sync, 60000);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', sync);
      unsubscribe();
      engine.dispose();
    };
  }, [user]);
  async function logout() {
    setLeaving(true);
    setMessage('');
    if (unit) {
      await unit.engine.flush();
      const current = unit.engine.current;
      if (
        current.status === 'conflict' ||
        (!current.localSaved && current.status !== 'saved')
      ) {
        setLeaving(false);
        setMessage(
          'Сначала сохраните резервную копию и разрешите конфликт версий.',
        );
        return;
      }
    }
    try {
      await signOut(auth);
    } catch (e) {
      setMessage(errorText(e));
      setLeaving(false);
    }
  }
  const bar = (
    <div className="account-bar">
      <span>{user.email}</span>
      <span role="status">{unit?.snapshot.message || 'Загружаем игру…'}</span>
      {unit?.snapshot.state && (
        <button
          onClick={() =>
            download(unit.snapshot.state!, 'play-your-life-backup.json')
          }
        >
          Скачать копию
        </button>
      )}
      <button disabled={leaving} onClick={() => void logout()}>
        Выйти
      </button>
      {message && <strong role="alert">{message}</strong>}
      {unit && !unit.snapshot.localSaved && (
        <strong role="alert">
          Браузер не сохраняет изменения. Дождитесь облачного сохранения или
          скачайте копию.
        </strong>
      )}
    </div>
  );
  if (!unit || !unit.snapshot.state)
    return (
      <div className="account-screen">
        <section className="account-card">
          {bar}
          <h2>
            {unit?.snapshot.status === 'error'
              ? 'Не удалось загрузить игру'
              : 'Загружаем твою игру…'}
          </h2>
          {unit?.snapshot.status === 'error' && (
            <button
              className="primary-button"
              onClick={() =>
                void unit.engine.start(() =>
                  newAccountGame(user.displayName || 'Игрок'),
                )
              }
            >
              Повторить загрузку
            </button>
          )}
        </section>
      </div>
    );
  const { engine, snapshot } = unit;
  if (snapshot.status === 'conflict')
    return (
      <div className="account-screen">
        <section className="account-card">
          {bar}
          <h2>Две версии игры</h2>
          <p>{snapshot.message} Автоматическая перезапись остановлена.</p>
          <p>
            На устройстве: {snapshot.state!.xp} XP. В облаке:{' '}
            {snapshot.remote?.state.xp ?? 'недоступно'} XP.
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              download(snapshot.state!, 'play-your-life-local.json');
              setBackup(true);
            }}
          >
            Скачать версию устройства
          </button>
          {snapshot.remote && (
            <>
              <button
                className="secondary-button"
                onClick={() =>
                  download(snapshot.remote!.state, 'play-your-life-cloud.json')
                }
              >
                Скачать облачную версию
              </button>
              <button
                className="primary-button"
                onClick={() =>
                  void engine
                    .chooseRemote(backup)
                    .catch((e) => setMessage(String(e.message)))
                }
              >
                Продолжить облачную игру
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Заменить облачную игру версией этого устройства? Сначала скачайте обе копии, если хотите сохранить их.',
                    )
                  )
                    void engine.chooseLocal();
                }}
              >
                Сохранить версию устройства в облако
              </button>
            </>
          )}
          <button
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            Повторить загрузку
          </button>
        </section>
      </div>
    );
  return (
    <App
      state={snapshot.state!}
      userId={user.uid}
      accountTools={bar}
      onChange={(next) => {
        const state = engine.current.state;
        if (state)
          engine.change(typeof next === 'function' ? next(state) : next);
      }}
    />
  );
}
export default function AccountRoot() {
  const [user, setUser] = useState<User | null | undefined>(undefined),
    [guest, setGuest] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined)
    return (
      <div className="account-screen">
        <p>Подключаем аккаунт…</p>
      </div>
    );
  if (user) return <CloudGame key={user.uid} user={user} />;
  if (guest)
    return (
      <App
        accountTools={
          <div className="account-bar">
            <span>Игра сохраняется на этом устройстве</span>
            <button onClick={() => setGuest(false)}>
              Войти / Зарегистрироваться
            </button>
          </div>
        }
      />
    );
  return <Login onGuest={() => setGuest(true)} />;
}
