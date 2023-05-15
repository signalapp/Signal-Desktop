import React from 'react';
import { Attachment, QuoteProps } from './Quote';
import { GoogleChrome } from '../../../../../util';
import { MIME } from '../../../../../types';

import { isEmpty, noop } from 'lodash';
import { QuoteImage } from './QuoteImage';
import styled from 'styled-components';
import { icons, SessionIconType } from '../../../../icon';

function getObjectUrl(thumbnail: Attachment | undefined): string | undefined {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return;
}

const StyledQuoteIconContainer = styled.div`
  flex: initial;
  min-width: 54px;
  width: 54px;
  max-height: 54px;
  position: relative;
`;

const StyledQuoteIcon = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;

  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledQuoteIconBackground = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  height: 54px;
  width: 54px;
  border-radius: var(--margins-sm);
  background-color: var(--message-link-preview-background-color);

  &:hover {
    background-color: var(--message-link-preview-background-color);
  }

  svg {
    width: 29px;
    height: 29px;
    fill: currentColor;
  }
`;

type QuoteIconTypes = Extract<SessionIconType, 'file' | 'image' | 'play' | 'movie' | 'microphone'>;

type QuoteIconProps = {
  icon: QuoteIconTypes;
};

export const QuoteIcon = (props: QuoteIconProps) => {
  const { icon } = props;
  const iconProps = icons[icon];

  return (
    <StyledQuoteIconContainer>
      <StyledQuoteIcon>
        <StyledQuoteIconBackground>
          <svg viewBox={iconProps.viewBox}>
            <path d={iconProps.path} />
          </svg>
        </StyledQuoteIconBackground>
      </StyledQuoteIcon>
    </StyledQuoteIconContainer>
  );
};

export const QuoteIconContainer = (
  props: Pick<QuoteProps, 'attachment' | 'referencedMessageNotFound'> & {
    handleImageErrorBound: () => void;
    imageBroken: boolean;
  }
) => {
  const { attachment, imageBroken, handleImageErrorBound, referencedMessageNotFound } = props;

  if (referencedMessageNotFound || !attachment || isEmpty(attachment)) {
    return null;
  }

  const { contentType, thumbnail } = attachment;
  const isGenericFile =
    !GoogleChrome.isVideoTypeSupported(contentType) &&
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !MIME.isAudio(contentType);

  if (isGenericFile) {
    return <QuoteIcon icon="file" />;
  }

  const objectUrl = getObjectUrl(thumbnail);
  if (objectUrl) {
    if (GoogleChrome.isVideoTypeSupported(contentType)) {
      return (
        <QuoteImage
          url={objectUrl}
          contentType={MIME.IMAGE_JPEG}
          showPlayButton={true}
          imageBroken={imageBroken}
          handleImageErrorBound={noop}
        />
      );
    }

    if (GoogleChrome.isImageTypeSupported(contentType)) {
      return (
        <QuoteImage
          url={objectUrl}
          contentType={contentType}
          imageBroken={imageBroken}
          handleImageErrorBound={handleImageErrorBound}
        />
      );
    }
  }

  if (MIME.isAudio(contentType)) {
    return <QuoteIcon icon="microphone" />;
  }

  return null;
};
