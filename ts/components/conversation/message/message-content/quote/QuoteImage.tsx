import React from 'react';
import classNames from 'classnames';
import { useDisableDrag } from '../../../../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../../../../hooks/useEncryptedFileFetch';
import styled from 'styled-components';

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

export const QuoteImage = (props: {
  handleImageErrorBound: () => void;
  url: string;
  contentType: string;
  icon?: string;
}) => {
  const { url, icon, contentType, handleImageErrorBound } = props;
  const disableDrag = useDisableDrag();

  const { loading, urlToLoad } = useEncryptedFileFetch(url, contentType, false);
  const srcData = !loading ? urlToLoad : '';

  const iconElement = icon ? (
    <div className="module-quote__icon-container__inner">
      <div className="module-quote__icon-container__circle-background">
        <div
          className={classNames(
            'module-quote__icon-container__icon',
            `module-quote__icon-container__icon--${icon}`
          )}
        />
      </div>
    </div>
  ) : null;

  return (
    <StyledQuoteImage>
      <img
        src={srcData}
        alt={window.i18n('quoteThumbnailAlt')}
        onDragStart={disableDrag}
        onError={handleImageErrorBound}
      />
      {iconElement}
    </StyledQuoteImage>
  );
};
