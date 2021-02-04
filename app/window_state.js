// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

let shouldQuitFlag = false;

function markShouldQuit() {
  shouldQuitFlag = true;
}

function shouldQuit() {
  return shouldQuitFlag;
}

module.exports = {
  shouldQuit,
  markShouldQuit,
};
