// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { AttachmentType } from '../../types/Attachment';
import { getExtensionForDisplay } from '../../types/Attachment';
import type { LocalizerType } from '../../types/Util';

export type Props = {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
  i18n: LocalizerType;
};

export const StagedGenericAttachment = ({
  attachment,
  i18n,
  onClose,
}: Props): JSX.Element => {
  const { fileName, contentType } = attachment;
  const extension = getExtensionForDisplay({ contentType, fileName });

  return (
    <div className="module-staged-attachment module-staged-generic-attachment">
      <button
        type="button"
        className="module-staged-generic-attachment__close-button"
        aria-label={i18n('close')}
        onClick={() => {
          if (onClose) {
            onClose(attachment);
          }
        }}
      />
      <div className="module-staged-generic-attachment__icon">
        {extension ? (
          <div className="module-staged-generic-attachment__icon__extension">
            {extension}
          </div>
        ) : null}
      </div>
      <div className="module-staged-generic-attachment__filename">
        {fileName}
      </div>
    </div>
  );
};
