// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { config } from '../../context/config.js';
import { getOSFunctions } from './shared.js';

const OS = getOSFunctions(config.osRelease);

export default OS;
