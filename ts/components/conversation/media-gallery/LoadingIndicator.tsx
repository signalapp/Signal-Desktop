// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export const LoadingIndicator = (): JSX.Element => {
  return (
    <div className="loading-widget">
      <div className="container">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
};
