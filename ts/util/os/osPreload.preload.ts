// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { config } from '../../context/config.preload.ts';
import { getOSFunctions } from './shared.std.ts';

const OS = getOSFunctions(config.osRelease);

export default OS;
