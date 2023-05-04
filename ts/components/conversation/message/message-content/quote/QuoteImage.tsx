import React from 'react';
import classNames from 'classnames';
import { useDisableDrag } from '../../../../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../../../../hooks/useEncryptedFileFetch';

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
    <div className="module-quote__icon-container">
      <img
        src={srcData}
        alt={window.i18n('quoteThumbnailAlt')}
        onDragStart={disableDrag}
        onError={handleImageErrorBound}
      />
      {iconElement}
    </div>
  );
};
