// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { AttachmentType } from '../../types/Attachment.std.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { FileThumbnail } from '../FileThumbnail.dom.js';

export type Props = {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
  i18n: LocalizerType;
};

export function StagedGenericAttachment({
  attachment,
  i18n,
  onClose,
}: Props): JSX.Element {
  const { fileName } = attachment;

  return (
    <div className="module-staged-attachment module-staged-generic-attachment">
      <button
        type="button"
        className="module-staged-generic-attachment__close-button"
        aria-label={i18n('icu:close')}
        onClick={() => {
          if (onClose) {
            onClose(attachment);
          }
        }}
      />

      <FileThumbnail {...attachment} />
      <div className="module-staged-generic-attachment__filename">
        {fileName}
      </div>
    </div>
  );
}
