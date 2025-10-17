// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Environment, getEnvironment } from '../../environment.std.js';

if (
  process.env.NODE_ENV !== 'production' &&
  getEnvironment() === Environment.Development &&
  Boolean(process.env.REACT_DEVTOOLS)
) {
  // Not bundled in the production app
  // eslint-disable-next-line max-len
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
  const { initialize, connectToDevTools } = require('react-devtools-core');

  initialize();
  connectToDevTools();
}
