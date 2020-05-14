export function put(key: string, value: any) {
  window.storage.put(key, value);
}

export function remove(key: string) {
  window.storage.remove(key);
}
