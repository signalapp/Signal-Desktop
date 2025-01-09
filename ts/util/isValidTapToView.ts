// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types';
import * as GoogleChrome from './GoogleChrome';

export function isValidTapToView(message: MessageAttributesType): boolean {
  const { body } = message;
  if (body) {
    return false;
  }

  const { attachments } = message;
  if (!attachments || attachments.length !== 1) {
    return false;
  }

  const firstAttachment = attachments[0];
  if (
    !GoogleChrome.isImageTypeSupported(firstAttachment.contentType) &&
    !GoogleChrome.isVideoTypeSupported(firstAttachment.contentType)
  ) {
    return false;
  }

  const { quote, sticker, contact, preview } = message;

  if (
    quote ||
    sticker ||
    (contact && contact.length > 0) ||
    (preview && preview.length > 0)
  ) {
    return false;
  }

  return true;
}
