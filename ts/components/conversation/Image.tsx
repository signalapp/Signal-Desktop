import React, { useCallback } from 'react';
import classNames from 'classnames';

import { Spinner } from '../basic/Spinner';
import { AttachmentType, AttachmentTypeWithPath } from '../../types/Attachment';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';

type Props = {
  alt: string;
  attachment: AttachmentTypeWithPath | AttachmentType;
  url: string | undefined; // url is undefined if the message is not visible yet

  height?: number;
  width?: number;

  overlayText?: string;

  bottomOverlay?: boolean;
  closeButton?: boolean;

  darkOverlay?: boolean;
  playIconOverlay?: boolean;
  softCorners?: boolean;

  onClick?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
  onClickClose?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
  onError?: () => void;
};

export const Image = (props: Props) => {
  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  const {
    alt,
    attachment,
    bottomOverlay,
    closeButton,
    darkOverlay,
    height,
    onClick,
    onClickClose,
    onError,
    overlayText,
    playIconOverlay,
    softCorners,
    url,
    width,
  } = props;

  const onDragStart = useCallback((e: any) => {
    e.preventDefault();
    return false;
  }, []);

  const onErrorUrlFilterering = useCallback(() => {
    if (url && onError) {
      onError();
    }
    return;
  }, [url, onError]);

  const { caption } = attachment || { caption: null };
  let { pending } = attachment || { pending: true };
  if (!url) {
    // force pending to true if the url is undefined, so we show a loader while decrypting the attachemtn
    pending = true;
  }
  const canClick = onClick && !pending;
  const role = canClick ? 'button' : undefined;
  const { loading, urlToLoad } = useEncryptedFileFetch(url || '', attachment.contentType);
  // data will be url if loading is finished and '' if not
  const srcData = !loading ? urlToLoad : '';

  return (
    <div
      role={role}
      onClick={(e: any) => {
        if (canClick && onClick) {
          e.stopPropagation();
          onClick(attachment);
        }
      }}
      className={classNames(
        'module-image',
        canClick ? 'module-image__with-click-handler' : null,
        softCorners ? 'module-image--soft-corners' : null
      )}
    >
      {pending || loading ? (
        <div
          className="module-image__loading-placeholder"
          style={{
            height: `${height}px`,
            width: `${width}px`,
            lineHeight: `${height}px`,
            textAlign: 'center',
          }}
        >
          <Spinner size="normal" />
        </div>
      ) : (
        <img
          onError={onErrorUrlFilterering}
          className="module-image__image"
          alt={alt}
          height={height}
          width={width}
          src={srcData}
          onDragStart={onDragStart}
        />
      )}
      {caption ? (
        <img
          className="module-image__caption-icon"
          src="images/caption-shadow.svg"
          alt={window.i18n('imageCaptionIconAlt')}
          onDragStart={onDragStart}
        />
      ) : null}
      <div
        className={classNames(
          'module-image__border-overlay',
          softCorners ? 'module-image--soft-corners' : null,
          darkOverlay ? 'module-image__border-overlay--dark' : null
        )}
      />
      {closeButton ? (
        <div
          role="button"
          onClick={(e: any) => {
            e.stopPropagation();
            if (onClickClose) {
              onClickClose(attachment);
            }
          }}
          className="module-image__close-button"
        />
      ) : null}
      {bottomOverlay ? <div className={classNames('module-image__bottom-overlay')} /> : null}
      {!(pending || loading) && playIconOverlay ? (
        <div className="module-image__play-overlay__circle">
          <div className="module-image__play-overlay__icon" />
        </div>
      ) : null}
      {overlayText ? (
        <div className="module-image__text-container" style={{ lineHeight: `${height}px` }}>
          {overlayText}
        </div>
      ) : null}
    </div>
  );
};
