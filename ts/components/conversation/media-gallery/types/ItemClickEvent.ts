// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../../../../model-types.d';
import type { AttachmentType } from '../../../../types/Attachment';

export type ItemClickEvent = {
  message: Pick<ReadonlyMessageAttributesType, 'sent_at'>;
  attachment: AttachmentType;
  index: number;
  type: 'media' | 'documents';
};
