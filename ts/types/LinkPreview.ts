// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AttachmentType } from './Attachment';

export type LinkPreviewImage = AttachmentType & {
  data: ArrayBuffer;
};

export type LinkPreviewResult = {
  title: string;
  url: string;
  image?: LinkPreviewImage;
  description: string | null;
  date: number | null;
};

export type LinkPreviewWithDomain = {
  domain: string;
} & LinkPreviewResult;
