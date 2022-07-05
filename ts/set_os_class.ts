// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

{
  let className: string;
  if (window.SignalContext.OS.isWindows()) {
    className = 'os-windows';
  } else if (window.SignalContext.OS.isMacOS()) {
    className = 'os-macos';
  } else if (window.SignalContext.OS.isLinux()) {
    className = 'os-linux';
  } else {
    throw new Error('Unexpected operating system; not applying ');
  }

  document.body.classList.add(className);

  if (window.SignalContext.OS.hasCustomTitleBar()) {
    document.body.classList.add('os-has-custom-titlebar');
  }
}
