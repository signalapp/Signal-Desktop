// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rule } from '../utils/rule.std.js';

export default rule('noLegacyVariables', context => {
  return {
    enterLiteral(element) {
      if (/(\$.+?\$)/.test(element.value)) {
        context.report(
          'String must not contain legacy $variables$',
          element.location
        );
      }
    },
  };
});
