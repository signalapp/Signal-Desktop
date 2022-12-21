// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types';

export function canMessageBeViewOnce(message: MessageAttributesType): 
    boolean {

    if(message.isViewOnce !== true){
        return false;
    }

    // Checks taken from isValidTapToView()
    const body = message.body;
    if (body) {
        return false;
    }

    const attachments = message.attachments;
    if (!attachments || attachments.length !== 1) {
        return false;
    }

    const firstAttachment = attachments[0];
    if (
        !window.Signal.Util.GoogleChrome.isImageTypeSupported(
        firstAttachment.contentType
        ) &&
        !window.Signal.Util.GoogleChrome.isVideoTypeSupported(
        firstAttachment.contentType
        )
    ) {
        return false;
    }

    if (
        message.quote ||
        message.sticker ||
        (message.contact && message.contact.length > 0) ||
        (message.preview && message.preview.length > 0)
    ) {
        return false;
    }

    // All checks passed, return true
    return true;
}
