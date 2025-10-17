// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rule } from '../utils/rule.std.js';

export default rule('noOrdinal', context => {
  return {
    enterPlural(element) {
      if (element.pluralType === 'ordinal') {
        context.report(
          '{selectordinal} is not supported by Smartling',
          element.location
        );
      }
    },
  };
});
