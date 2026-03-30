// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { AttachmentType } from '../../types/Attachment.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { FileThumbnail } from '../FileThumbnail.dom.tsx';

export type Props = {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
  i18n: LocalizerType;
};

export function StagedGenericAttachment({
  attachment,
  i18n,
  onClose,
}: Props): React.JSX.Element {
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
