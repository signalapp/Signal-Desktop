// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';

export const shouldBlurAvatar = ({
  acceptedMessageRequest,
  avatarPath,
  isMe,
  sharedGroupNames,
  unblurredAvatarPath,
}: Readonly<
  Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'isMe'
    | 'sharedGroupNames'
    | 'unblurredAvatarPath'
  >
>): boolean =>
  Boolean(
    !isMe &&
      !acceptedMessageRequest &&
      !sharedGroupNames.length &&
      avatarPath &&
      avatarPath !== unblurredAvatarPath
  );
