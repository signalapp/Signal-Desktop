// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType, AttachmentWithHydratedData } from '../Attachment';

type GenericLinkPreviewType<Image> = {
  title?: string;
  description?: string;
  domain?: string;
  url: string;
  isStickerPack?: boolean;
  isCallLink?: boolean;
  image?: Readonly<Image>;
  date?: number;
};

export type LinkPreviewType = GenericLinkPreviewType<AttachmentType>;
export type LinkPreviewWithHydratedData =
  GenericLinkPreviewType<AttachmentWithHydratedData>;
