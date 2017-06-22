let shouldQuitFlag = false;

function markShouldQuit() {
  shouldQuitFlag = true;
}

function shouldQuit() {
  return shouldQuitFlag;
}

module.exports = {
  shouldQuit,
  markShouldQuit
};
