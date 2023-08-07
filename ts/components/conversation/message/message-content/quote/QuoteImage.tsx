import React from 'react';
import styled from 'styled-components';
import { isEmpty } from 'lodash';

import { useDisableDrag } from '../../../../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../../../../hooks/useEncryptedFileFetch';

import { icons } from '../../../../icon';
import { QuoteIcon } from './QuoteIconContainer';

const StyledQuoteImage = styled.div`
  flex: initial;
  min-width: 54px;
  width: 54px;
  max-height: 54px;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StyledPlayButton = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;

  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;

  div {
    display: flex;
    align-items: center;
    justify-content: center;

    height: 32px;
    width: 32px;
    border-radius: 50%;
    background-color: var(--chat-buttons-background-color);

    padding-left: 3px;

    &:hover {
      background-color: var(--chat-buttons-background-hover-color);
    }
  }

  svg {
    width: 14px;
    height: 14px;
    fill: var(--chat-buttons-icon-color);
  }
`;

export const QuoteImage = (props: {
  url: string;
  contentType: string;
  showPlayButton?: boolean;
  imageBroken: boolean;
  handleImageErrorBound: () => void;
}) => {
  const { url, contentType, showPlayButton, imageBroken, handleImageErrorBound } = props;

  const disableDrag = useDisableDrag();

  const { loading, urlToLoad } = useEncryptedFileFetch(url, contentType, false);
  const srcData = !loading ? urlToLoad : '';

  return !isEmpty(srcData) && !imageBroken ? (
    <StyledQuoteImage>
      <img
        src={srcData}
        alt={window.i18n('quoteThumbnailAlt')}
        onDragStart={disableDrag}
        onError={handleImageErrorBound}
      />
      {showPlayButton && (
        <StyledPlayButton>
          <div>
            <svg viewBox={icons.play.viewBox}>
              <path d={icons.play.path} />
            </svg>
          </div>
        </StyledPlayButton>
      )}
    </StyledQuoteImage>
  ) : (
    <QuoteIcon icon={showPlayButton ? 'movie' : 'image'} />
  );
};
