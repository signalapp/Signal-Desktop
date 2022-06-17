// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../Attachment';

export type LinkPreviewType = {
  title?: string;
  description?: string;
  domain?: string;
  url: string;
  isStickerPack?: boolean;
  image?: Readonly<AttachmentType>;
  date?: number;
};
