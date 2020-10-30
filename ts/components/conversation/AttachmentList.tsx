// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';
import { Image } from './Image';
import { StagedGenericAttachment } from './StagedGenericAttachment';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment';
import { LocalizerType } from '../../types/Util';
import {
  areAllAttachmentsVisual,
  AttachmentType,
  getUrl,
  isVideoAttachment,
} from '../../types/Attachment';

export interface Props {
  attachments: Array<AttachmentType>;
  i18n: LocalizerType;
  onClickAttachment: (attachment: AttachmentType) => void;
  onCloseAttachment: (attachment: AttachmentType) => void;
  onAddAttachment: () => void;
  onClose: () => void;
}

const IMAGE_WIDTH = 120;
const IMAGE_HEIGHT = 120;

export const AttachmentList = ({
  attachments,
  i18n,
  onAddAttachment,
  onClickAttachment,
  onCloseAttachment,
  onClose,
}: Props): JSX.Element | null => {
  if (!attachments.length) {
    return null;
  }

  const allVisualAttachments = areAllAttachmentsVisual(attachments);

  return (
    <div className="module-attachments">
      {attachments.length > 1 ? (
        <div className="module-attachments__header">
          <button
            type="button"
            onClick={onClose}
            className="module-attachments__close-button"
            aria-label={i18n('close')}
          />
        </div>
      ) : null}
      <div className="module-attachments__rail">
        {(attachments || []).map((attachment, index) => {
          const { contentType } = attachment;
          if (
            isImageTypeSupported(contentType) ||
            isVideoTypeSupported(contentType)
          ) {
            const imageKey = getUrl(attachment) || attachment.fileName || index;
            const clickCallback =
              attachments.length > 1 ? onClickAttachment : undefined;

            return (
              <Image
                key={imageKey}
                alt={i18n('stagedImageAttachment', [
                  getUrl(attachment) || attachment.fileName,
                ])}
                i18n={i18n}
                attachment={attachment}
                softCorners
                playIconOverlay={isVideoAttachment(attachment)}
                height={IMAGE_HEIGHT}
                width={IMAGE_WIDTH}
                url={getUrl(attachment)}
                closeButton
                onClick={clickCallback}
                onClickClose={onCloseAttachment}
                onError={() => {
                  onCloseAttachment(attachment);
                }}
              />
            );
          }

          const genericKey = getUrl(attachment) || attachment.fileName || index;

          return (
            <StagedGenericAttachment
              key={genericKey}
              attachment={attachment}
              i18n={i18n}
              onClose={onCloseAttachment}
            />
          );
        })}
        {allVisualAttachments ? (
          <StagedPlaceholderAttachment onClick={onAddAttachment} i18n={i18n} />
        ) : null}
      </div>
    </div>
  );
};
