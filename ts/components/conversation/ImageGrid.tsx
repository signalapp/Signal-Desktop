import React, { useContext } from 'react';
import classNames from 'classnames';

import {
  areAllAttachmentsVisual,
  AttachmentType,
  AttachmentTypeWithPath,
  getAlt,
  getImageDimensionsInAttachment,
  getThumbnailUrl,
  isVideoAttachment,
} from '../../types/Attachment';

import { Image } from './Image';
import { IsMessageVisibleContext } from './message/message-content/MessageContent';

type Props = {
  attachments: Array<AttachmentTypeWithPath>;
  bottomOverlay?: boolean;
  onError: () => void;
  onClickAttachment?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
};
// tslint:disable: cyclomatic-complexity max-func-body-length use-simple-attributes
export const ImageGrid = (props: Props) => {
  const { attachments, bottomOverlay, onError, onClickAttachment } = props;

  const isMessageVisible = useContext(IsMessageVisibleContext);

  const withBottomOverlay = Boolean(bottomOverlay);

  if (!attachments || !attachments.length) {
    return null;
  }

  if (attachments.length === 1 || !areAllAttachmentsVisual(attachments)) {
    const { height, width } = getImageDimensionsInAttachment(attachments[0]);

    return (
      <div className={classNames('module-image-grid', 'module-image-grid--one-image')}>
        <Image
          alt={getAlt(attachments[0])}
          bottomOverlay={withBottomOverlay}
          attachment={attachments[0]}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={height}
          width={width}
          url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
          onClick={onClickAttachment}
          onError={onError}
          attachmentIndex={0}
        />
      </div>
    );
  }

  if (attachments.length === 2) {
    return (
      <div className="module-image-grid">
        <Image
          alt={getAlt(attachments[0])}
          attachment={attachments[0]}
          bottomOverlay={withBottomOverlay}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={149}
          width={149}
          url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
          onClick={onClickAttachment}
          onError={onError}
          attachmentIndex={0}
        />
        <Image
          alt={getAlt(attachments[1])}
          bottomOverlay={withBottomOverlay}
          playIconOverlay={isVideoAttachment(attachments[1])}
          height={149}
          width={149}
          attachment={attachments[1]}
          url={isMessageVisible ? getThumbnailUrl(attachments[1]) : undefined}
          onClick={onClickAttachment}
          onError={onError}
          attachmentIndex={1}
        />
      </div>
    );
  }

  if (attachments.length === 3) {
    return (
      <div className="module-image-grid">
        <Image
          alt={getAlt(attachments[0])}
          bottomOverlay={withBottomOverlay}
          attachment={attachments[0]}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={200}
          width={199}
          url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
          onClick={onClickAttachment}
          onError={onError}
          attachmentIndex={0}
        />
        <div className="module-image-grid__column">
          <Image
            alt={getAlt(attachments[1])}
            height={99}
            width={99}
            attachment={attachments[1]}
            playIconOverlay={isVideoAttachment(attachments[1])}
            url={isMessageVisible ? getThumbnailUrl(attachments[1]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={1}
          />
          <Image
            alt={getAlt(attachments[2])}
            bottomOverlay={withBottomOverlay}
            height={99}
            width={99}
            attachment={attachments[2]}
            playIconOverlay={isVideoAttachment(attachments[2])}
            url={isMessageVisible ? getThumbnailUrl(attachments[2]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={2}
          />
        </div>
      </div>
    );
  }

  if (attachments.length === 4) {
    return (
      <div className="module-image-grid">
        <div className="module-image-grid__column">
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachments[0])}
              attachment={attachments[0]}
              playIconOverlay={isVideoAttachment(attachments[0])}
              height={149}
              width={149}
              url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
              onClick={onClickAttachment}
              onError={onError}
              attachmentIndex={0}
            />
            <Image
              alt={getAlt(attachments[1])}
              playIconOverlay={isVideoAttachment(attachments[1])}
              height={149}
              width={149}
              attachment={attachments[1]}
              url={isMessageVisible ? getThumbnailUrl(attachments[1]) : undefined}
              onClick={onClickAttachment}
              onError={onError}
              attachmentIndex={1}
            />
          </div>
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachments[2])}
              bottomOverlay={withBottomOverlay}
              playIconOverlay={isVideoAttachment(attachments[2])}
              height={149}
              width={149}
              attachment={attachments[2]}
              url={isMessageVisible ? getThumbnailUrl(attachments[2]) : undefined}
              onClick={onClickAttachment}
              onError={onError}
              attachmentIndex={2}
            />
            <Image
              alt={getAlt(attachments[3])}
              bottomOverlay={withBottomOverlay}
              playIconOverlay={isVideoAttachment(attachments[3])}
              height={149}
              width={149}
              attachment={attachments[3]}
              url={isMessageVisible ? getThumbnailUrl(attachments[3]) : undefined}
              onClick={onClickAttachment}
              onError={onError}
              attachmentIndex={3}
            />
          </div>
        </div>
      </div>
    );
  }

  const moreMessagesOverlay = attachments.length > 5;
  const moreMessagesOverlayText = moreMessagesOverlay ? `+${attachments.length - 5}` : undefined;

  return (
    <div className="module-image-grid">
      <div className="module-image-grid__column">
        <div className="module-image-grid__row">
          <Image
            alt={getAlt(attachments[0])}
            attachment={attachments[0]}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={149}
            width={149}
            url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={0}
          />
          <Image
            alt={getAlt(attachments[1])}
            playIconOverlay={isVideoAttachment(attachments[1])}
            height={149}
            width={149}
            attachment={attachments[1]}
            url={isMessageVisible ? getThumbnailUrl(attachments[1]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={1}
          />
        </div>
        <div className="module-image-grid__row">
          <Image
            alt={getAlt(attachments[2])}
            bottomOverlay={withBottomOverlay}
            playIconOverlay={isVideoAttachment(attachments[2])}
            height={99}
            width={99}
            attachment={attachments[2]}
            url={isMessageVisible ? getThumbnailUrl(attachments[2]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={2}
          />
          <Image
            alt={getAlt(attachments[3])}
            bottomOverlay={withBottomOverlay}
            playIconOverlay={isVideoAttachment(attachments[3])}
            height={99}
            width={98}
            attachment={attachments[3]}
            url={isMessageVisible ? getThumbnailUrl(attachments[3]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={3}
          />
          <Image
            alt={getAlt(attachments[4])}
            bottomOverlay={withBottomOverlay}
            playIconOverlay={isVideoAttachment(attachments[4])}
            height={99}
            width={99}
            darkOverlay={moreMessagesOverlay}
            overlayText={moreMessagesOverlayText}
            attachment={attachments[4]}
            url={isMessageVisible ? getThumbnailUrl(attachments[4]) : undefined}
            onClick={onClickAttachment}
            onError={onError}
            attachmentIndex={4}
          />
        </div>
      </div>
    </div>
  );
};
