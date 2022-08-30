import React, { useContext } from 'react';

import {
  areAllAttachmentsVisual,
  AttachmentType,
  AttachmentTypeWithPath,
  getAlt,
  getThumbnailUrl,
  isVideoAttachment,
} from '../../types/Attachment';

import { Image } from './Image';
import { IsMessageVisibleContext } from './message/message-content/MessageContent';
import styled from 'styled-components';
import { THUMBNAIL_SIDE } from '../../types/attachments/VisualAttachment';

type Props = {
  attachments: Array<AttachmentTypeWithPath>;
  onError: () => void;
  onClickAttachment?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
};

const StyledImageGrid = styled.div`
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--margins-sm);
`;

const StyledImageGridColumn = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--margins-sm);
`;

// tslint:disable: cyclomatic-complexity max-func-body-length use-simple-attributes
export const ImageGrid = (props: Props) => {
  const { attachments, onError, onClickAttachment } = props;

  const isMessageVisible = useContext(IsMessageVisibleContext);

  if (!attachments || !attachments.length) {
    return null;
  }

  const shared = {
    onClick: onClickAttachment,
    onError: onError,
    softCorners: true,
  };

  if (attachments.length === 1 || !areAllAttachmentsVisual(attachments)) {
    return (
      <StyledImageGrid>
        <Image
          alt={getAlt(attachments[0])}
          attachment={attachments[0]}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={THUMBNAIL_SIDE}
          width={THUMBNAIL_SIDE}
          url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
          attachmentIndex={0}
          {...shared}
        />
      </StyledImageGrid>
    );
  }

  if (attachments.length === 2) {
    // when we got 2 attachments we render them side by side with the full size of THUMBNAIL_SIDE
    return (
      <StyledImageGrid>
        <Image
          alt={getAlt(attachments[0])}
          attachment={attachments[0]}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={THUMBNAIL_SIDE}
          width={THUMBNAIL_SIDE}
          url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
          attachmentIndex={0}
          {...shared}
        />
        <Image
          alt={getAlt(attachments[1])}
          playIconOverlay={isVideoAttachment(attachments[1])}
          height={THUMBNAIL_SIDE}
          width={THUMBNAIL_SIDE}
          attachment={attachments[1]}
          url={isMessageVisible ? getThumbnailUrl(attachments[1]) : undefined}
          attachmentIndex={1}
          {...shared}
        />
      </StyledImageGrid>
    );
  }

  const moreMessagesOverlay = attachments.length > 3;
  const moreMessagesOverlayText = moreMessagesOverlay ? `+${attachments.length - 3}` : undefined;

  const columnImageSide = THUMBNAIL_SIDE / 2 - 5;

  // we know only support having 3 attachments displayed at most.
  return (
    <StyledImageGrid>
      <Image
        alt={getAlt(attachments[0])}
        attachment={attachments[0]}
        playIconOverlay={isVideoAttachment(attachments[0])}
        height={THUMBNAIL_SIDE}
        width={THUMBNAIL_SIDE}
        url={isMessageVisible ? getThumbnailUrl(attachments[0]) : undefined}
        attachmentIndex={0}
        {...shared}
      />
      <StyledImageGridColumn>
        <Image
          alt={getAlt(attachments[1])}
          height={columnImageSide}
          width={columnImageSide}
          attachment={attachments[1]}
          playIconOverlay={isVideoAttachment(attachments[1])}
          url={isMessageVisible ? getThumbnailUrl(attachments[1]) : undefined}
          attachmentIndex={1}
          {...shared}
        />
        <Image
          alt={getAlt(attachments[2])}
          height={columnImageSide}
          width={columnImageSide}
          attachment={attachments[2]}
          playIconOverlay={isVideoAttachment(attachments[2])}
          url={isMessageVisible ? getThumbnailUrl(attachments[2]) : undefined}
          attachmentIndex={2}
          darkOverlay={moreMessagesOverlay}
          overlayText={moreMessagesOverlayText}
          {...shared}
        />
      </StyledImageGridColumn>
    </StyledImageGrid>
  );
};
