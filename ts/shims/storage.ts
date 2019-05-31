export async function put(key: string, value: any) {
  // @ts-ignore
  return window.storage.put(key, value);
}

export async function remove(key: string) {
  // @ts-ignore
  return window.storage.remove(key);
}
