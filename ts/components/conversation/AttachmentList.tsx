// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';

import { CurveType, Image } from './Image.dom.js';
import { StagedGenericAttachment } from './StagedGenericAttachment.dom.js';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import type {
  AttachmentForUIType,
  AttachmentDraftType,
} from '../../types/Attachment.std.js';
import {
  areAllAttachmentsVisual,
  canDisplayImage,
  isImageAttachment,
  isVideoAttachment,
} from '../../util/Attachment.std.js';

export type Props<T extends AttachmentForUIType | AttachmentDraftType> =
  Readonly<{
    attachments: ReadonlyArray<T>;
    canEditImages?: boolean;
    i18n: LocalizerType;
    onAddAttachment?: () => void;
    onClickAttachment?: (attachment: T) => void;
    onClose?: () => void;
    onCloseAttachment: (attachment: T) => void;
  }>;

const IMAGE_WIDTH = 120;
const IMAGE_HEIGHT = 120;

// This is a 1x1 black square.
const BLANK_VIDEO_THUMBNAIL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR42mNiAAAABgADm78GJQAAAABJRU5ErkJggg==';

function getUrl(
  attachment: AttachmentForUIType | AttachmentDraftType
): string | undefined {
  if (attachment.pending) {
    return undefined;
  }

  if ('screenshot' in attachment) {
    return attachment.screenshot?.url || attachment.url;
  }

  return attachment.url;
}

export function AttachmentList<
  T extends AttachmentForUIType | AttachmentDraftType,
>({
  attachments,
  canEditImages,
  i18n,
  onAddAttachment,
  onClickAttachment,
  onCloseAttachment,
  onClose,
}: Props<T>): JSX.Element | null {
  const attachmentsForUI = useMemo(() => {
    return attachments.map((attachment: T): AttachmentForUIType => {
      // Already ForUI attachment
      if ('isPermanentlyUndownloadable' in attachment) {
        return attachment;
      }

      // Draft
      return {
        ...attachment,
        isPermanentlyUndownloadable: false,
      };
    });
  }, [attachments]);

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
            aria-label={i18n('icu:close')}
          />
        </div>
      ) : null}
      <div className="module-attachments__rail">
        {attachments.map((attachment, index) => {
          const url = getUrl(attachment);
          const forUI = attachmentsForUI[index];

          const key =
            attachment.clientUuid ||
            url ||
            attachment.path ||
            attachment.fileName ||
            index;

          const isImage = isImageAttachment(attachment);
          const isVideo = isVideoAttachment(attachment);
          const closeAttachment = () => onCloseAttachment(attachment);

          if (
            (isImage && canDisplayImage([attachment])) ||
            isVideo ||
            attachment.pending
          ) {
            const imageUrl =
              url || (isVideo ? BLANK_VIDEO_THUMBNAIL : undefined);

            const clickAttachment = onClickAttachment
              ? () => onClickAttachment(attachment)
              : undefined;

            const imgElement = (
              <Image
                key={key}
                alt={i18n('icu:stagedImageAttachment', {
                  path: attachment.fileName || url || index.toString(),
                })}
                className="module-staged-attachment"
                i18n={i18n}
                attachment={forUI}
                curveBottomLeft={CurveType.Tiny}
                curveBottomRight={CurveType.Tiny}
                curveTopLeft={CurveType.Tiny}
                curveTopRight={CurveType.Tiny}
                playIconOverlay={isVideo}
                height={IMAGE_HEIGHT}
                width={IMAGE_WIDTH}
                url={imageUrl}
                closeButton
                showVisualAttachment={clickAttachment}
                onClickClose={closeAttachment}
                onError={closeAttachment}
              />
            );

            if (isImage && canEditImages) {
              return (
                <div className="module-attachments--editable" key={key}>
                  {imgElement}
                  <div className="module-attachments__edit-icon" />
                </div>
              );
            }

            return imgElement;
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
}
