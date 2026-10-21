// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChatStyle } from './ChatStyle.std.ts';

export type Account = Readonly<{
  defaultBubbleColor: ChatStyle['bubbleColor'] | null;
}>;
