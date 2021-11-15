// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Image } from './Image';
import { StagedGenericAttachment } from './StagedGenericAttachment';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment';
import type { LocalizerType } from '../../types/Util';
import type { AttachmentDraftType } from '../../types/Attachment';
import {
  areAllAttachmentsVisual,
  isImageAttachment,
  isVideoAttachment,
} from '../../types/Attachment';

export type Props = Readonly<{
  attachments: ReadonlyArray<AttachmentDraftType>;
  i18n: LocalizerType;
  onAddAttachment?: () => void;
  onClickAttachment?: (attachment: AttachmentDraftType) => void;
  onClose?: () => void;
  onCloseAttachment: (attachment: AttachmentDraftType) => void;
}>;

const IMAGE_WIDTH = 120;
const IMAGE_HEIGHT = 120;

// This is a 1x1 black square.
const BLANK_VIDEO_THUMBNAIL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR42mNiAAAABgADm78GJQAAAABJRU5ErkJggg==';

function getUrl(attachment: AttachmentDraftType): string | undefined {
  if (attachment.pending) {
    return undefined;
  }

  return attachment.url;
}

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
      {onClose && attachments.length > 1 ? (
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
          const url = getUrl(attachment);

          const key = url || attachment.path || attachment.fileName || index;

          const isImage = isImageAttachment(attachment);
          const isVideo = isVideoAttachment(attachment);
          const closeAttachment = () => onCloseAttachment(attachment);

          if (isImage || isVideo || attachment.pending) {
            const isDownloaded = !attachment.pending;
            const imageUrl =
              url || (isVideo ? BLANK_VIDEO_THUMBNAIL : undefined);

            const clickAttachment = onClickAttachment
              ? () => onClickAttachment(attachment)
              : undefined;

            return (
              <Image
                key={key}
                alt={i18n('stagedImageAttachment', [
                  attachment.fileName || url || index.toString(),
                ])}
                className="module-staged-attachment"
                i18n={i18n}
                attachment={attachment}
                isDownloaded={isDownloaded}
                softCorners
                playIconOverlay={isVideo}
                height={IMAGE_HEIGHT}
                width={IMAGE_WIDTH}
                url={imageUrl}
                closeButton
                onClick={clickAttachment}
                onClickClose={closeAttachment}
                onError={closeAttachment}
              />
            );
          }

          return (
            <StagedGenericAttachment
              key={key}
              attachment={attachment}
              i18n={i18n}
              onClose={closeAttachment}
            />
          );
        })}
        {allVisualAttachments && onAddAttachment ? (
          <StagedPlaceholderAttachment onClick={onAddAttachment} i18n={i18n} />
        ) : null}
      </div>
    </div>
  );
};
