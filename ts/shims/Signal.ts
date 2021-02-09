import { getPasswordHash } from '../../js/modules/data';

export async function hasPassword() {
  const hash = await getPasswordHash();

  return !!hash;
}
