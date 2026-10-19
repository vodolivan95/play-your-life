import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

type Props = {
  children: ReactNode;
  /** Когда значение меняется (игрок открыл другой раздел), сообщение об ошибке убирается. */
  resetKey?: string;
  /** `section` — сломался один раздел; `app` — сломалось всё приложение. */
  scope?: 'section' | 'app';
};
type State = { error: Error | null };

/**
 * Не даёт ошибке в одном месте превратиться в белый экран: вместо пустой страницы
 * игрок видит понятное сообщение. Сам компонент ничего не пишет в сохранения.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ошибка интерфейса', error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const app = this.props.scope === 'app';
    return (
      <section className={`error-boundary${app ? ' is-app' : ''}`} role="alert">
        <h2>{app ? 'Игра не открылась' : 'Этот раздел не открылся'}</h2>
        <p>
          {app
            ? 'Ваши данные не затронуты. Обновите страницу — игра загрузится заново.'
            : 'Ваши данные не затронуты, сохранение продолжает работать. Откройте другой раздел или попробуйте ещё раз.'}
        </p>
        <div className="error-boundary-actions">
          {!app && (
            <button type="button" className="secondary-button" onClick={() => this.setState({ error: null })}>
              Попробовать снова
            </button>
          )}
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Обновить страницу
          </button>
        </div>
        <small>{error.message}</small>
      </section>
    );
  }
}
