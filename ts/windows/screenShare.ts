// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This needs to use window.React & window.ReactDOM since it's
// not commonJS compatible.
window.registerScreenShareControllerRenderer((Component, props) => {
  window.ReactDOM.render(
    window.React.createElement(Component, props),
    document.getElementById('app')
  );
});
