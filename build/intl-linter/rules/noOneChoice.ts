// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rule } from '../utils/rule.std.js';

export default rule('noOneChoice', context => {
  return {
    enterPlural(element) {
      if (Object.keys(element.options).length < 2) {
        context.report(
          '{plural} requires multiple options for Smartling',
          element.location
        );
      }
    },
  };
});
