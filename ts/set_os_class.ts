// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

{
  let className: string;
  if (window.SignalContext.OS.isWindows()) {
    className = 'os-windows';
    if (window.SignalContext.OS.isWindows11()) {
      document.body.classList.add('os-windows-11');
    }
  } else if (window.SignalContext.OS.isMacOS()) {
    className = 'os-macos';
  } else if (window.SignalContext.OS.isLinux()) {
    className = 'os-linux';
  } else {
    throw new Error('Unexpected operating system; not applying ');
  }

  document.body.classList.add(className);
}
