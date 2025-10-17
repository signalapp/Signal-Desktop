// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export function LoadingIndicator(): JSX.Element {
  return (
    <div className="loading-widget">
      {/* eslint-disable-next-line local-rules/enforce-tw */}
      <div className="container">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
