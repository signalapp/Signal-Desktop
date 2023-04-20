// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';
import { getOSFunctions } from './shared';

const OS = getOSFunctions(os.release());

export default OS;
