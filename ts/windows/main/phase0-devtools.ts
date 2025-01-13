// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import '../context';
import { initialize, connectToDevTools } from 'react-devtools-core';
import { Environment, getEnvironment } from '../../environment';

if (
  getEnvironment() === Environment.Development &&
  Boolean(process.env.REACT_DEVTOOLS)
) {
  initialize();
  connectToDevTools();
}
