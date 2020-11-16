// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AttachmentType } from '../../../../types/Attachment';
import { Message } from './Message';

export interface ItemClickEvent {
  message: Message;
  attachment: AttachmentType;
  type: 'media' | 'documents';
}
