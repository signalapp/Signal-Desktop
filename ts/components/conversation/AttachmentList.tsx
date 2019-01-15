import React from 'react';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';
import { AttachmentType } from './types';
import { Image } from './Image';
import { areAllAttachmentsVisual } from './ImageGrid';
import { StagedGenericAttachment } from './StagedGenericAttachment';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment';
import { Localizer } from '../../types/Util';

interface Props {
  attachments: Array<AttachmentType>;
  i18n: Localizer;
  // onError: () => void;
  onClickAttachment: (attachment: AttachmentType) => void;
  onCloseAttachment: (attachment: AttachmentType) => void;
  onAddAttachment: () => void;
  onClose: () => void;
}

const IMAGE_WIDTH = 120;
const IMAGE_HEIGHT = 120;

export class AttachmentList extends React.Component<Props> {
  // tslint:disable-next-line max-func-body-length */
  public render() {
    const {
      attachments,
      i18n,
      onAddAttachment,
      onClickAttachment,
      onCloseAttachment,
      onClose,
    } = this.props;

    if (!attachments.length) {
      return null;
    }

    const allVisualAttachments = areAllAttachmentsVisual(attachments);

    return (
      <div className="module-attachments">
        {attachments.length > 1 ? (
          <div className="module-attachments__header">
            <div
              role="button"
              onClick={onClose}
              className="module-attachments__close-button"
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
              return (
                <Image
                  key={getUrl(attachment) || attachment.fileName || index}
                  alt={i18n('stagedImageAttachment', [
                    getUrl(attachment) || attachment.fileName,
                  ])}
                  i18n={i18n}
                  attachment={attachment}
                  softCorners={true}
                  playIconOverlay={isVideoAttachment(attachment)}
                  height={IMAGE_HEIGHT}
                  width={IMAGE_WIDTH}
                  url={getUrl(attachment)}
                  closeButton={true}
                  onClick={
                    attachments.length > 1 ? onClickAttachment : undefined
                  }
                  onClickClose={onCloseAttachment}
                />
              );
            }

            return (
              <StagedGenericAttachment
                key={getUrl(attachment) || attachment.fileName || index}
                attachment={attachment}
                i18n={i18n}
                onClose={onCloseAttachment}
              />
            );
          })}
          {allVisualAttachments ? (
            <StagedPlaceholderAttachment onClick={onAddAttachment} />
          ) : null}
        </div>
      </div>
    );
  }
}

export function isVideoAttachment(attachment?: AttachmentType) {
  return (
    attachment &&
    attachment.contentType &&
    isVideoTypeSupported(attachment.contentType)
  );
}

function getUrl(attachment: AttachmentType) {
  if (attachment.screenshot) {
    return attachment.screenshot.url;
  }

  return attachment.url;
}
