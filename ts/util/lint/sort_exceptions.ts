// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { writeFileSync } from 'fs';

import type { ExceptionType } from './types';
import { loadJSON, sortExceptions } from './util';

const exceptionsPath = join(__dirname, 'exceptions.json');
const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);

const sorted = sortExceptions(exceptions);

writeFileSync(exceptionsPath, JSON.stringify(sorted, null, '  '));
