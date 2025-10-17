// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rule } from '../utils/rule.std.js';

export default rule('noOffset', context => {
  return {
    enterPlural(element) {
      if (element.offset !== 0) {
        context.report(
          '{plural} with offset is not supported by Smartling',
          element.location
        );
      }
    },
  };
});
