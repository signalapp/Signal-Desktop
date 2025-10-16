// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { join } from 'node:path';

import type { ExceptionType } from './types.std.js';
import { loadJSON } from './util.node.js';

const { fromPairs, groupBy, map } = lodash;

const exceptionsPath = join(__dirname, 'exceptions.json');
const exceptions: Array<ExceptionType> = loadJSON(exceptionsPath);
const byRule = groupBy(exceptions, 'rule');

const byRuleThenByCategory = fromPairs(
  map(byRule, (list, ruleName) => {
    const byCategory = groupBy(list, 'reasonCategory');

    return [
      ruleName,
      fromPairs(
        map(byCategory, (innerList, categoryName) => {
          return [categoryName, innerList.length];
        })
      ),
    ];
  })
);

// eslint-disable-next-line no-console
console.log(JSON.stringify(byRuleThenByCategory, null, '  '));
