import { Storage } from './storage';

async function markDone() {
  await Storage.put('chromiumRegistrationDoneEver', '');
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

export const Registration = { markDone, isDone, everDone, remove };
