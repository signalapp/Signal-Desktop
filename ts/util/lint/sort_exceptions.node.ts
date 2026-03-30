// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';

import type { ExceptionType } from './types.std.ts';
import { loadJSON, writeExceptions } from './util.node.ts';

const exceptionsPath = join(__dirname, 'exceptions.json');
const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);

writeExceptions(exceptionsPath, exceptions);
