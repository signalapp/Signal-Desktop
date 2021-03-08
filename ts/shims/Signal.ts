import { getPasswordHash } from '../../ts/data/data';

export async function hasPassword() {
  const hash = await getPasswordHash();

  return !!hash;
}
