import * as wrappers from 'libsodium-wrappers-sumo';

export async function getSodiumNode() {
  // don't ask me why, but when called from node we have to do this as the types are incorrect?!
  const anyWrappers = wrappers as any;
  await anyWrappers.ready;
  return anyWrappers.default;
}
