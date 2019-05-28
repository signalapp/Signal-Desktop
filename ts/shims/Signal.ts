export async function hasPassword() {
  // @ts-ignore
  const hash = await window.Signal.Data.getPasswordHash();

  return !!hash;
}
