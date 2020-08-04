// Hides UI with Ctrl+L, Un-hides with Ctrl+; or Ctrl +'

document.onkeyup = function(lockscreen) {
  if (lockscreen.ctrlKey && lockscreen.which == 76) {
    document.body.style.display = "none";
  }
  if (lockscreen.ctrlKey && lockscreen.which == 186) {
    document.body.style.display = "block";
  }
  if (lockscreen.ctrlKey && lockscreen.which == 222) {
    document.body.style.display = "block";
  }
};
