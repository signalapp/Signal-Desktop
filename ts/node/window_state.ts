let shouldQuitFlag = false;

export function markShouldQuit() {
  shouldQuitFlag = true;
}

export function shouldQuit() {
  return shouldQuitFlag;
}
