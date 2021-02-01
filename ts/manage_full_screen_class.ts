// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

$(document).ready(() => {
  const updateFullScreenClass = (isFullScreen: boolean) => {
    $(document.body).toggleClass('full-screen', isFullScreen);
  };
  updateFullScreenClass(window.isFullScreen());
  window.onFullScreenChange = updateFullScreenClass;
});
