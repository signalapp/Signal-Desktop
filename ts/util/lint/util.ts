/* eslint-disable no-console */

import { readFileSync } from 'fs';

import { orderBy } from 'lodash';

import { ExceptionType } from './types';

export const ENCODING = 'utf8';

export function loadJSON<T>(target: string): T {
  try {
    const contents = readFileSync(target, ENCODING);

    return JSON.parse(contents);
  } catch (error) {
    console.log(`Error loading JSON from ${target}: ${error.stack}`);
    throw error;
  }
}

export function sortExceptions(
  exceptions: Array<ExceptionType>
): Array<ExceptionType> {
  return orderBy(exceptions, ['path', 'lineNumber', 'rule']);
}
