import * as RegistrationSelectors from '../state/selectors/registration';

export function markEverDone() {
  // @ts-ignore
  window.storage.put('chromiumRegistrationDoneEver', '');
}

export function markDone() {
  markEverDone();
  // @ts-ignore
  window.storage.put('chromiumRegistrationDone', '');
}

export function remove() {
  // @ts-ignore
  window.storage.remove('chromiumRegistrationDone');
}

export function isDone() {
  // @ts-ignore
  return RegistrationSelectors.isDone(window.reduxStore.getState());
}

export function everDone() {
  // @ts-ignore
  return RegistrationSelectors.everDone(window.reduxStore.getState());
}
