import { useSyncExternalStore } from "react";
import { reduceGame, type Action } from "../engine/game";
import { localAdapter } from "./storage";
let state = localAdapter.load();
let storageError = "";
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function dispatch(action: Action) {
  state = reduceGame(state, action);
  try {
    localAdapter.save(state);
    storageError = "";
  } catch {
    storageError =
      "Не удалось сохранить данные. Проверьте доступность хранилища браузера.";
  }
  listeners.forEach((listener) => listener());
}
export function useGame() {
  const value = useSyncExternalStore(subscribe, () => state);
  return { state: value, dispatch, storageError };
}
