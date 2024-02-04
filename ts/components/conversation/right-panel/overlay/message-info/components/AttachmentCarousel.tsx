import { isEmpty } from 'lodash';
import React, { useCallback, useState } from 'react';
import styled, { CSSProperties } from 'styled-components';
import { PropsForAttachment } from '../../../../../../state/ducks/conversations';
import { getAlt, getThumbnailUrl, isVideoAttachment } from '../../../../../../types/Attachment';
import { Flex } from '../../../../../basic/Flex';
import { SessionIconButton } from '../../../../../icon';
import { Image } from '../../../../Image';
import {
  StyledSubtitleDotMenu,
  SubtitleDotMenu,
} from '../../../../header/ConversationHeaderSubtitle';
import { showLightboxFromAttachmentProps } from '../../../../message/message-content/MessageAttachment';

const CarouselButton = (props: { visible: boolean; rotation: number; onClick: () => void }) => {
  return (
    <SessionIconButton
      iconSize={'huge'}
      iconType={'chevron'}
      iconRotation={props.rotation}
      onClick={props.onClick}
      iconPadding={'var(--margins-xs)'}
      style={{
        visibility: props.visible ? 'visible' : 'hidden',
      }}
    />
  );
};

const StyledFullscreenButton = styled.div``;

const FullscreenButton = (props: { onClick: () => void; style?: CSSProperties }) => {
  return (
    <StyledFullscreenButton style={props.style}>
      <SessionIconButton
        iconSize={'large'}
        iconColor={'var(--button-icon-stroke-hover-color)'}
        iconType={'fullscreen'}
        onClick={props.onClick}
        iconPadding={'6px'}
      />
    </StyledFullscreenButton>
  );
};

const ImageContainer = styled.div`
  position: relative;

  ${StyledSubtitleDotMenu} {
    position: absolute;
    bottom: 8px;
    left: 0;
    right: 0;
    margin: 0 auto;
    z-index: 2;
  }

  ${StyledFullscreenButton} {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 2;
  }
`;

type Props = {
  messageId: string;
  attachments: Array<PropsForAttachment>;
  visibleIndex: number;
  nextAction: () => void;
  previousAction: () => void;
};

export const AttachmentCarousel = (props: Props) => {
  const { messageId, attachments, visibleIndex, nextAction, previousAction } = props;

  const [imageBroken, setImageBroken] = useState(false);

  const handleImageError = useCallback(() => {
    setImageBroken(true);
  }, [setImageBroken]);

  if (isEmpty(attachments)) {
    window.log.debug('No attachments to render in carousel');
    return null;
  }

  const isVideo = isVideoAttachment(attachments[visibleIndex]);

  const showLightbox = () => {
    void showLightboxFromAttachmentProps(messageId, attachments[visibleIndex]);
  };

  if (imageBroken) {
    return null;
  }

  return (
    <Flex container={true} flexDirection={'row'} justifyContent={'center'} alignItems={'center'}>
      <CarouselButton visible={visibleIndex > 0} onClick={previousAction} rotation={90} />
      <ImageContainer>
        <Image
          alt={getAlt(attachments[visibleIndex])}
          attachment={attachments[visibleIndex]}
          playIconOverlay={isVideo}
          height={'var(--right-panel-attachment-height)'}
          width={'var(--right-panel-attachment-width)'}
          url={getThumbnailUrl(attachments[visibleIndex])}
          attachmentIndex={visibleIndex}
          softCorners={true}
          onClick={isVideo ? showLightbox : undefined}
          onError={handleImageError}
        />
        <SubtitleDotMenu
          id={'attachment-carousel-subtitle-dots'}
          selectedOptionIndex={visibleIndex}
          optionsCount={attachments.length}
          style={{
            display: attachments.length < 2 ? 'none' : 'undefined',
            padding: '6px',
            backgroundColor: 'var(--modal-background-color)',
            borderRadius: '50px',
            width: 'fit-content',
          }}
        />
        <FullscreenButton
          onClick={showLightbox}
          style={{
            backgroundColor: 'var(--modal-background-color)',
            borderRadius: '50px',
          }}
        />
      </ImageContainer>
      <CarouselButton
        visible={visibleIndex < attachments.length - 1}
        onClick={nextAction}
        rotation={270}
      />
    </Flex>
  );
};
