// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export function LoadingIndicator(): React.JSX.Element {
  return (
    <div className="loading-widget">
      {/* oxlint-disable-next-line signal-desktop/enforce-tw */}
      <div className="container">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
