function markEverDone() {
  storage.put('chromiumRegistrationDoneEver', '');
}
function markDone() {
  this.markEverDone();
  storage.put('chromiumRegistrationDone', '');
}
function isDone() {
  return storage.get('chromiumRegistrationDone') === '';
}
function everDone() {
  return (
    storage.get('chromiumRegistrationDoneEver') === '' ||
    storage.get('chromiumRegistrationDone') === ''
  );
}
function remove() {
  storage.remove('chromiumRegistrationDone');
}

export const Registration = { markEverDone, markDone, isDone, everDone, remove };
