type Language = 'en' | 'ru';
type Issue = { start: number; end: number; word: string; language: Language };
type Spellcheckable = HTMLInputElement | HTMLTextAreaElement;
type WorkerMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'checked'; requestId: number; issues: Issue[] }
  | { type: 'suggestions'; requestId: number; suggestions: string[] };

type ActiveField = {
  element: Spellcheckable;
  color: string;
  colorPriority: string;
  caretColor: string;
  caretPriority: string;
  textColor: string;
  placeholderColor: string;
  fillColor: string;
  fillPriority: string;
  issues: Issue[];
  value: string;
  checkRequest: number;
};

const FIELD_SELECTOR = 'textarea, input:not([type]), input[type="text"], input[type="search"]';
const state = { worker: undefined as Worker | undefined, active: undefined as ActiveField | undefined, overlay: undefined as HTMLDivElement | undefined, popup: undefined as HTMLDivElement | undefined, ready: false, failed: false, composing: new WeakSet<Spellcheckable>(), nextRequest: 0, debounce: undefined as number | undefined, pendingSuggestion: undefined as { field: ActiveField; issue: Issue } | undefined };

function isSpellcheckable(target: EventTarget | null): target is Spellcheckable {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return false;
  if (target instanceof HTMLInputElement && !['', 'text', 'search'].includes(target.type)) return false;
  return !target.disabled && !target.readOnly && target.getAttribute('data-spellcheck') !== 'off';
}

function ensureWorker(): Worker {
  if (!state.worker) {
    state.worker = new Worker(new URL('./spellcheck.worker.ts', import.meta.url), { type: 'module' });
    state.worker.addEventListener('message', onWorkerMessage);
    state.worker.postMessage({ type: 'init', baseUrl: import.meta.env.BASE_URL });
  }
  return state.worker;
}

function ensureOverlay(): HTMLDivElement {
  if (!state.overlay) {
    const overlay = document.createElement('div');
    overlay.className = 'spellcheck-mirror';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    const content = document.createElement('div');
    content.className = 'spellcheck-mirror-content';
    overlay.append(content);
    document.body.append(overlay);
    state.overlay = overlay;
  }
  return state.overlay;
}

function closePopup(): void {
  state.popup?.remove();
  state.popup = undefined;
  state.pendingSuggestion = undefined;
}

function restoreField(field: ActiveField): void {
  field.element.style.setProperty('color', field.color, field.colorPriority);
  field.element.style.setProperty('caret-color', field.caretColor, field.caretPriority);
  field.element.style.setProperty('-webkit-text-fill-color', field.fillColor, field.fillPriority);
  field.element.removeAttribute('data-spellcheck-active');
  if (field.element.isConnected) field.element.setAttribute('spellcheck', state.failed ? 'true' : 'false');
}

function leaveField(): void {
  const field = state.active;
  if (field) restoreField(field);
  state.active = undefined;
  if (state.overlay) state.overlay.hidden = true;
  closePopup();
}

function copyFieldStyle(field: ActiveField): void {
  const element = field.element;
  const overlay = ensureOverlay();
  const host = element.closest('dialog[open]') ?? document.body;
  if (overlay.parentElement !== host) host.append(overlay);
  const rect = element.getBoundingClientRect();
  const css = getComputedStyle(element);
  const style = overlay.style;
  style.left = `${rect.left}px`;
  style.top = `${rect.top}px`;
  style.width = `${rect.width}px`;
  style.height = `${rect.height}px`;
  style.boxSizing = css.boxSizing;
  style.padding = css.padding;
  style.border = css.border;
  style.borderColor = 'transparent';
  style.font = css.font;
  style.fontFamily = css.fontFamily;
  style.fontSize = css.fontSize;
  style.fontWeight = css.fontWeight;
  style.fontStyle = css.fontStyle;
  style.letterSpacing = css.letterSpacing;
  style.lineHeight = css.lineHeight;
  style.textAlign = css.textAlign;
  style.textIndent = css.textIndent;
  style.textTransform = css.textTransform;
  style.direction = css.direction;
  style.tabSize = css.tabSize;
  style.whiteSpace = element instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  style.overflowWrap = element instanceof HTMLTextAreaElement ? 'break-word' : 'normal';
  style.wordBreak = css.wordBreak;
  style.overflow = 'hidden';
  style.color = field.textColor;
  style.setProperty('--spellcheck-placeholder-color', field.placeholderColor || field.textColor);
  overlay.dataset.kind = element instanceof HTMLTextAreaElement ? 'multiline' : 'singleline';
  const content = overlay.firstElementChild as HTMLDivElement;
  content.style.transform = `translate(${-element.scrollLeft}px, ${-element.scrollTop}px)`;
  overlay.hidden = false;
}

function renderOverlay(field: ActiveField): void {
  if (state.active !== field || !field.element.isConnected) return;
  const overlay = ensureOverlay();
  copyFieldStyle(field);
  const content = overlay.firstElementChild as HTMLDivElement;
  content.replaceChildren();
  if (!field.value && field.element.placeholder) {
    const placeholder = document.createElement('span');
    placeholder.className = 'spellcheck-placeholder';
    placeholder.textContent = field.element.placeholder;
    content.append(placeholder);
    return;
  }
  let cursor = 0;
  for (const issue of field.issues) {
    if (issue.start < cursor || issue.end > field.value.length) continue;
    content.append(document.createTextNode(field.value.slice(cursor, issue.start)));
    const span = document.createElement('span');
    span.className = 'spellcheck-error-word';
    span.textContent = field.value.slice(issue.start, issue.end);
    span.setAttribute('aria-hidden', 'true');
    content.append(span);
    cursor = issue.end;
  }
  content.append(document.createTextNode(field.value.slice(cursor)));
}

function scheduleCheck(field: ActiveField): void {
  if (state.debounce) window.clearTimeout(state.debounce);
  field.checkRequest = ++state.nextRequest;
  field.value = field.element.value;
  field.issues = [];
  renderOverlay(field);
  state.debounce = window.setTimeout(() => {
    if (state.active !== field || !field.element.isConnected) return;
    if (!state.ready) return;
    const requestId = ++state.nextRequest;
    field.checkRequest = requestId;
    ensureWorker().postMessage({ type: 'check', requestId, text: field.value });
  }, 180);
}

function showPopup(field: ActiveField, issue: Issue, x: number, y: number): void {
  closePopup();
  const popup = document.createElement('div');
  popup.className = 'spellcheck-popover';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', issue.language === 'ru' ? 'Варианты исправления' : 'Spelling suggestions');
  const heading = document.createElement('div');
  heading.className = 'spellcheck-popover-heading';
  heading.textContent = `${issue.language === 'ru' ? 'Возможно, ошибка' : 'Possible spelling mistake'}: ${issue.word}`;
  popup.append(heading);
  const choices = document.createElement('div');
  choices.className = 'spellcheck-popover-choices';
  choices.textContent = state.ready ? (issue.language === 'ru' ? 'Подбираю варианты…' : 'Finding suggestions…') : 'Загружаю словари…';
  popup.append(choices);
  const host = field.element.closest('dialog[open]') ?? document.body;
  host.append(popup);
  state.popup = popup;
  state.pendingSuggestion = { field, issue };
  const left = Math.max(8, Math.min(x, window.innerWidth - 300));
  const top = Math.max(8, Math.min(y + 14, window.innerHeight - 130));
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  if (state.ready) requestSuggestions(field, issue, choices);
}

function requestSuggestions(field: ActiveField, issue: Issue, choices: HTMLElement): void {
  const requestId = ++state.nextRequest;
  state.pendingSuggestion = { field, issue };
  ensureWorker().postMessage({ type: 'suggest', requestId, word: issue.word, language: issue.language });
  choices.dataset.requestId = String(requestId);
}

function issueAtCaret(field: ActiveField): Issue | undefined {
  const input = field.element;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? start;
  return field.issues.find(issue => (start === end && start >= issue.start && start <= issue.end) || (start < issue.end && end > issue.start));
}

function onPointerUp(event: PointerEvent): void {
  const target = event.target;
  if (!isSpellcheckable(target) || target !== state.active?.element) return;
  window.setTimeout(() => {
    const field = state.active;
    if (!field || field.element !== target) return;
    const issue = issueAtCaret(field);
    if (issue) showPopup(field, issue, event.clientX, event.clientY);
    else closePopup();
  }, 0);
}

function replaceWord(suggestion: string): void {
  const pending = state.pendingSuggestion;
  if (!pending || !pending.field.element.isConnected) return;
  const { field, issue } = pending;
  const element = field.element;
  element.focus();
  element.setRangeText(suggestion, issue.start, issue.end, 'end');
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: suggestion }));
  closePopup();
  window.setTimeout(() => {
    if (state.active === field) scheduleCheck(field);
  }, 0);
}

function makeSuggestionButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'spellcheck-suggestion';
  button.textContent = text;
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', () => replaceWord(text));
  return button;
}

function onWorkerMessage(event: MessageEvent<WorkerMessage>): void {
  const message = event.data;
  if (message.type === 'ready') {
    state.ready = true;
    const field = state.active;
    if (field) scheduleCheck(field);
    if (state.pendingSuggestion && state.popup) {
      const { field: target, issue } = state.pendingSuggestion;
      const choices = state.popup.querySelector<HTMLDivElement>('.spellcheck-popover-choices');
      if (choices) requestSuggestions(target, issue, choices);
    }
    return;
  }
  if (message.type === 'error') {
    state.failed = true;
    document.querySelectorAll<Spellcheckable>(FIELD_SELECTOR).forEach(element => element.setAttribute('spellcheck', 'true'));
    const field = state.active;
    if (field) {
      restoreField(field);
      field.element.setAttribute('spellcheck', 'true');
      if (state.overlay) state.overlay.hidden = true;
    }
    if (state.popup) {
      const choices = state.popup.querySelector<HTMLDivElement>('.spellcheck-popover-choices');
      if (choices) choices.textContent = 'Не удалось загрузить словари. Проверьте подключение к интернету.';
    }
    return;
  }
  if (message.type === 'checked') {
    const field = state.active;
    if (!field || field.checkRequest !== message.requestId || field.value !== field.element.value) return;
    field.issues = message.issues;
    renderOverlay(field);
    return;
  }
  if (message.type === 'suggestions') {
    const choices = state.popup?.querySelector<HTMLDivElement>('.spellcheck-popover-choices');
    if (!choices || choices.dataset.requestId !== String(message.requestId)) return;
    choices.replaceChildren();
    if (message.suggestions.length === 0) {
      choices.textContent = 'Нет вариантов замены';
      return;
    }
    message.suggestions.forEach(suggestion => choices.append(makeSuggestionButton(suggestion)));
    const pending = state.pendingSuggestion;
    if (pending && choices.firstElementChild instanceof HTMLButtonElement) {
      choices.firstElementChild.setAttribute('aria-label', `Заменить ${pending.issue.word} на ${message.suggestions[0]}`);
    }
  }
}

function activate(element: Spellcheckable): void {
  if (state.active?.element === element) return;
  leaveField();
  if (state.failed) {
    element.setAttribute('spellcheck', 'true');
    return;
  }
  const css = getComputedStyle(element);
  const field: ActiveField = {
    element,
    color: element.style.getPropertyValue('color'),
    colorPriority: element.style.getPropertyPriority('color'),
    caretColor: element.style.getPropertyValue('caret-color'),
    caretPriority: element.style.getPropertyPriority('caret-color'),
    textColor: css.color,
    placeholderColor: getComputedStyle(element, '::placeholder').color,
    fillColor: element.style.getPropertyValue('-webkit-text-fill-color'),
    fillPriority: element.style.getPropertyPriority('-webkit-text-fill-color'),
    issues: [],
    value: element.value,
    checkRequest: 0,
  };
  state.active = field;
  element.setAttribute('spellcheck', 'false');
  element.setAttribute('data-spellcheck-active', 'true');
  element.style.setProperty('color', 'transparent', 'important');
  element.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
  element.style.setProperty('caret-color', css.caretColor || css.color, 'important');
  ensureOverlay();
  ensureWorker();
  scheduleCheck(field);
}

function register(element: Element): void {
  if (!isSpellcheckable(element)) {
    if (state.active?.element === element) leaveField();
    return;
  }
  element.setAttribute('spellcheck', state.failed ? 'true' : 'false');
  element.setAttribute('data-spellcheck', 'local');
  if (document.activeElement === element) activate(element);
}

function onFocusIn(event: FocusEvent): void {
  if (isSpellcheckable(event.target)) activate(event.target);
}

function onFocusOut(event: FocusEvent): void {
  const field = state.active;
  if (!field || event.target !== field.element) return;
  const next = event.relatedTarget;
  if (next instanceof Node && state.popup?.contains(next)) return;
  window.setTimeout(() => {
    if (state.active === field && document.activeElement !== field.element && !state.popup?.contains(document.activeElement)) leaveField();
  }, 0);
}

function onClick(event: MouseEvent): void {
  if (event.target === state.popup || state.popup?.contains(event.target as Node)) return;
  if (event.target === state.active?.element) onPointerUp({ target: event.target, clientX: event.clientX, clientY: event.clientY } as PointerEvent);
  else if (!(event.target instanceof HTMLButtonElement && event.target.classList.contains('spellcheck-suggestion'))) closePopup();
}

function onContextMenu(event: MouseEvent): void {
  const target = event.target;
  if (!isSpellcheckable(target) || target !== state.active?.element) return;
  const field = state.active;
  const issue = field && issueAtCaret(field);
  if (issue) {
    event.preventDefault();
    showPopup(field, issue, event.clientX, event.clientY);
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.popup) {
    event.preventDefault();
    closePopup();
    state.active?.element.focus();
  }
}

function onInput(event: Event): void {
  const target = event.target;
  if (isSpellcheckable(target) && target === state.active?.element && !state.composing.has(target)) {
    closePopup();
    scheduleCheck(state.active);
  }
}

function onCompositionStart(event: CompositionEvent): void {
  if (!isSpellcheckable(event.target)) return;
  state.composing.add(event.target);
  if (state.debounce) window.clearTimeout(state.debounce);
  state.debounce = undefined;
}

function onCompositionEnd(event: CompositionEvent): void {
  const target = event.target;
  if (!isSpellcheckable(target)) return;
  state.composing.delete(target);
  if (target === state.active?.element) scheduleCheck(state.active);
}

function onScroll(): void {
  const field = state.active;
  if (!field) return;
  if (document.activeElement === field.element) renderOverlay(field);
  else leaveField();
}

export function enableNativeSpellcheck(): void {
  document.querySelectorAll(FIELD_SELECTOR).forEach(register);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof Element) register(record.target);
      const activeElement = state.active?.element;
      if (activeElement && record.removedNodes.length > 0 && [...record.removedNodes].some(node => node === activeElement || node instanceof Element && node.contains(activeElement))) leaveField();
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        register(node);
        node.querySelectorAll(FIELD_SELECTOR).forEach(register);
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'readonly', 'disabled'],
  });
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('compositionstart', onCompositionStart, true);
  document.addEventListener('compositionend', onCompositionEnd, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
}
