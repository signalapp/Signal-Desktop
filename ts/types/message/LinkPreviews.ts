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
  callLinkRoomId?: string;
  image?: Readonly<Image>;
  date?: number;
};

export type LinkPreviewType = GenericLinkPreviewType<AttachmentType>;
export type LinkPreviewWithHydratedData =
  GenericLinkPreviewType<AttachmentWithHydratedData>;

export function isSameLinkPreview(
  prev: LinkPreviewType | undefined | null,
  next: LinkPreviewType | undefined | null
): boolean {
  // Both has to be absent or present
  if (prev == null || next == null) {
    return prev == null && next == null;
  }

  if (prev.url !== next.url) {
    return false;
  }
  if (prev.title !== next.title) {
    return false;
  }
  if (prev.description !== next.description) {
    return false;
  }
  if (prev.image?.plaintextHash !== next.image?.plaintextHash) {
    return false;
  }

  return true;
}
