// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rule } from '../utils/rule.std.js';

export default rule('onePlural', context => {
  let plurals = 0;
  return {
    enterPlural(element) {
      plurals += 1;
      if (plurals > 1) {
        context.report(
          'Multiple {plural} is not supported by Smartling',
          element.location
        );
      }
    },
  };
});
