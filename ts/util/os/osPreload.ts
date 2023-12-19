// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { config } from '../../context/config';
import { getOSFunctions } from './shared';

const OS = getOSFunctions(config.osRelease);

export default OS;
