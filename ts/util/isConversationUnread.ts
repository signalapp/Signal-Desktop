// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

const { isNumber } = lodash;

export const isConversationUnread = ({
  markedUnread,
  unreadCount,
}: Readonly<{
  unreadCount?: number;
  markedUnread?: boolean;
}>): boolean =>
  Boolean(markedUnread || (isNumber(unreadCount) && unreadCount > 0));
