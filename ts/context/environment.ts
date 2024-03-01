// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { config } from './config';
import {
  getEnvironment,
  isTestEnvironment,
  parseEnvironment,
  setEnvironment,
} from '../environment';

setEnvironment(parseEnvironment(config.environment));

const environment = getEnvironment();

const isTestOrMockEnvironment =
  isTestEnvironment(environment) || Boolean(process.env.MOCK_TEST);

export { environment, isTestOrMockEnvironment };
