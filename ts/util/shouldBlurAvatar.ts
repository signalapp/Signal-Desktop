// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';

export const shouldBlurAvatar = ({
  acceptedMessageRequest,
  avatarUrl,
  isMe,
  sharedGroupNames,
  unblurredAvatarUrl,
}: Readonly<
  Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'isMe'
    | 'sharedGroupNames'
    | 'unblurredAvatarUrl'
  >
>): boolean =>
  Boolean(
    !isMe &&
      !acceptedMessageRequest &&
      !sharedGroupNames.length &&
      avatarUrl &&
      avatarUrl !== unblurredAvatarUrl
  );
