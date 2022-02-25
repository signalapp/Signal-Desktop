// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';

import type { ExceptionType } from './types';
import { loadJSON, writeExceptions } from './util';

const exceptionsPath = join(__dirname, 'exceptions.json');
const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);

writeExceptions(exceptionsPath, exceptions);
