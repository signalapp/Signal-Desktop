// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rule } from '../utils/rule.std.js';

export default rule('icuPrefix', context => {
  if (!context.messageId.startsWith('icu:')) {
    context.report('ICU message IDs must start with "icu:"');
  }
  return {};
});
