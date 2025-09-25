// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { config } from './config.js';
import {
  getEnvironment,
  parseEnvironment,
  setEnvironment,
} from '../environment.js';

setEnvironment(
  parseEnvironment(config.environment),
  config.isMockTestEnvironment
);

const environment = getEnvironment();

export { environment };
