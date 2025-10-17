// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PluralElement } from '@formatjs/icu-messageformat-parser';
import { rule } from '../utils/rule.std.js';

export default rule('pluralPound', context => {
  const stack: Array<PluralElement> = [];
  return {
    enterPlural(element) {
      stack.push(element);
    },
    exitPlural() {
      stack.pop();
    },
    enterLiteral(element, parent) {
      // Note: Without the stack this could be turned into a rule to check for
      // explicit numbers anywhere in the message.
      if (parent == null) {
        return;
      }
      if (parent !== stack.at(-1)) {
        return;
      }
      // Adapted from https://github.com/TalhaAwan/get-numbers
      // Checks for explicit whitespace before and after the number.
      const index = element.value.search(/(^| )(-\d+|\d+)(,\d+)*(\.\d+)*($| )/);
      if (index > -1) {
        context.report(
          'Use # instead of an explicit number',
          element.location,
          index
        );
      }
    },
  };
});
