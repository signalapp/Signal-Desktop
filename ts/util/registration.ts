import { Storage } from './storage';

async function markEverDone() {
  await Storage.put('chromiumRegistrationDoneEver', '');
}
async function markDone() {
  await markEverDone();
  await Storage.put('chromiumRegistrationDone', '');
}
function isDone() {
  return Storage.get('chromiumRegistrationDone') === '';
}
function everDone() {
  return (
    Storage.get('chromiumRegistrationDoneEver') === '' ||
    Storage.get('chromiumRegistrationDone') === ''
  );
}
async function remove() {
  await Storage.remove('chromiumRegistrationDone');
}

export const Registration = { markEverDone, markDone, isDone, everDone, remove };
