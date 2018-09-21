// tslint:disable no-console

import { join } from 'path';
import { writeFileSync } from 'fs';

import { ExceptionType } from './types';
import { loadJSON, sortExceptions } from './util';

const exceptionsPath = join(__dirname, 'exceptions.json');
const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);

const sorted = sortExceptions(exceptions);

writeFileSync(exceptionsPath, JSON.stringify(sorted, null, '  '));
