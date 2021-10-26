// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../../../../types/Attachment';
import type { Message } from './Message';

export type ItemClickEvent = {
  message: Message;
  attachment: AttachmentType;
  type: 'media' | 'documents';
};
