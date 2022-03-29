let shouldQuitFlag = false;

export function windowMarkShouldQuit() {
  shouldQuitFlag = true;
}

export function windowShouldQuit() {
  return shouldQuitFlag;
}
