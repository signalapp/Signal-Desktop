// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Element } from '../utils/rule.std.js';
import { rule } from '../utils/rule.std.js';

export default rule('noNestedChoice', context => {
  let insideChoice = false;

  function check(element: Element) {
    if (insideChoice) {
      context.report(
        'Nested {select}/{plural} is not supported by Smartling',
        element.location
      );
    }
  }

  return {
    enterSelect(element) {
      check(element);
      insideChoice = true;
    },
    exitSelect() {
      insideChoice = false;
    },
    enterPlural(element) {
      check(element);
      insideChoice = true;
    },
    exitPlural() {
      insideChoice = false;
    },
  };
});
