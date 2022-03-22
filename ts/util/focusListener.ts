let windowFocused = false;
window.addEventListener('blur', () => {
  windowFocused = false;
});
window.addEventListener('focus', () => {
  windowFocused = true;
});

export const isWindowFocused = () => windowFocused;
