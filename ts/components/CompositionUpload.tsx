// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEventHandler } from 'react';
import React, { forwardRef } from 'react';

import type { AttachmentDraftType } from '../types/Attachment';
import { isVideoAttachment, isImageAttachment } from '../types/Attachment';
import type { LocalizerType } from '../types/Util';

import {
  getSupportedImageTypes,
  getSupportedVideoTypes,
} from '../util/GoogleChrome';

export type PropsType = {
  conversationId: string;
  draftAttachments: ReadonlyArray<AttachmentDraftType>;
  i18n: LocalizerType;
  processAttachments: (options: {
    conversationId: string;
    files: ReadonlyArray<File>;
    flags: number | null;
  }) => unknown;
};

export const CompositionUpload = forwardRef<HTMLInputElement, PropsType>(
  function CompositionUploadInner(
    { conversationId, draftAttachments, processAttachments },
    ref
  ) {
    const onFileInputChange: ChangeEventHandler<
      HTMLInputElement
    > = async event => {
      const files = event.target.files || [];

      await processAttachments({
        conversationId,
        files: Array.from(files),
        flags: null,
      });
    };

    const anyVideoOrImageAttachments = draftAttachments.some(attachment => {
      return isImageAttachment(attachment) || isVideoAttachment(attachment);
    });

    const acceptContentTypes = anyVideoOrImageAttachments
      ? [...getSupportedImageTypes(), ...getSupportedVideoTypes()]
      : null;

    return (
      <input
        data-testid="attachfile-input"
        hidden
        multiple
        onChange={onFileInputChange}
        ref={ref}
        type="file"
        accept={acceptContentTypes?.join(',')}
      />
    );
  }
);
