export function markEverDone() {
  // @ts-ignore
  window.storage.put('chromiumRegistrationDoneEver', '');
}

export function markDone() {
  markEverDone();
  window.storage.put('chromiumRegistrationDone', '');
}

export function remove() {
  window.storage.remove('chromiumRegistrationDone');
}

export function isDone() {
  // tslint:disable-next-line no-backbone-get-set-outside-model
  return window.storage.get('chromiumRegistrationDone') === '';
}

export function everDone() {
  // tslint:disable-next-line no-backbone-get-set-outside-model
  return window.storage.get('chromiumRegistrationDoneEver') === '' || isDone();
}
