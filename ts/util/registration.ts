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
  // tslint:disable-next-line no-backbone-get-set-outside-model
  return window.storage.get('chromiumRegistrationDone') === '';
}

export function everDone() {
  // @ts-ignore
  // tslint:disable-next-line no-backbone-get-set-outside-model
  return window.storage.get('chromiumRegistrationDoneEver') === '' || isDone();
}
