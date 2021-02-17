// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

$(document).ready(() => {
  let className: string;
  if (window.Signal.OS.isWindows()) {
    className = 'os-windows';
  } else if (window.Signal.OS.isMacOS()) {
    className = 'os-macos';
  } else if (window.Signal.OS.isLinux()) {
    className = 'os-linux';
  } else {
    throw new Error('Unexpected operating system; not applying ');
  }

  $(document.body).addClass(className);
});
