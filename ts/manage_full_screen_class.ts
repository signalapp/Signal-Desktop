// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

{
  const updateFullScreenClass = (
    isFullScreen: boolean,
    isMaximized: boolean
  ) => {
    document.body.classList.toggle('full-screen', isFullScreen);
    document.body.classList.toggle('maximized', isMaximized);
  };
  updateFullScreenClass(window.isFullScreen(), window.isMaximized());
  window.onFullScreenChange = updateFullScreenClass;
}
