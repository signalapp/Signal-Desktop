import classNames from 'classnames';
import { useCallback } from 'react';
import styled from 'styled-components';

import { isNumber } from 'lodash';
import { useDisableDrag } from '../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { AttachmentType, AttachmentTypeWithPath } from '../../types/Attachment';
import { Spinner } from '../basic/Spinner';

type Props = {
  alt: string;
  attachment: AttachmentTypeWithPath | AttachmentType;
  url: string | undefined; // url is undefined if the message is not visible yet

  height?: number | string;
  width?: number | string;

  overlayText?: string;

  closeButton?: boolean;

  darkOverlay?: boolean;
  playIconOverlay?: boolean;
  softCorners: boolean;
  forceSquare?: boolean;
  dropShadow?: boolean;
  attachmentIndex?: number;

  onClick?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
  onClickClose?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
  onError?: () => void;
};

const StyledOverlay = styled.div<Pick<Props, 'darkOverlay' | 'softCorners'>>`
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  left: 0;
  right: 0;
  background-color: ${props =>
    props.darkOverlay ? 'var(--message-link-preview-background-color)' : 'unset'};
`;
export const Image = (props: Props) => {
  const {
    alt,
    attachment,
    closeButton,
    darkOverlay,
    height: _height,
    onClick,
    onClickClose,
    onError,
    overlayText,
    playIconOverlay,
    softCorners,
    forceSquare,
    dropShadow,
    attachmentIndex,
    url,
    width: _width,
  } = props;

  const onErrorUrlFilterering = useCallback(() => {
    if (url && onError) {
      onError();
    }
  }, [url, onError]);
  const disableDrag = useDisableDrag();

  const { caption } = attachment || { caption: null };
  let { pending } = attachment || { pending: true };
  if (!url) {
    // force pending to true if the url is undefined, so we show a loader while decrypting the attachemtn
    pending = true;
  }
  const canClick = onClick && !pending;
  const role = canClick ? 'button' : undefined;
  const { loading, urlToLoad } = useEncryptedFileFetch(url || '', attachment.contentType, false);
  // data will be url if loading is finished and '' if not
  const srcData = !loading ? urlToLoad : '';

  const width = isNumber(_width) ? `${_width}px` : _width;
  const height = isNumber(_height) ? `${_height}px` : _height;

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
      style={{
        maxHeight: height,
        maxWidth: width,
        minHeight: height,
        minWidth: width,
        boxShadow: dropShadow ? 'var(--drop-shadow)' : undefined,
      }}
      data-attachmentindex={attachmentIndex}
    >
      {pending || loading ? (
        <div
          className="module-image__loading-placeholder"
          style={{
            maxHeight: height,
            maxWidth: width,
            width,
            height,
            lineHeight: height,
            textAlign: 'center',
          }}
        >
          <Spinner size="normal" />
        </div>
      ) : (
        <img
          onError={onErrorUrlFilterering}
          className={classNames(
            'module-image__image',
            forceSquare ? 'module-image__image-cover' : ''
          )}
          alt={alt}
          style={{
            maxHeight: height,
            maxWidth: width,
            minHeight: height,
            minWidth: width,
            width: forceSquare ? width : '',
            height: forceSquare ? height : '',
          }}
          src={srcData}
          onDragStart={disableDrag}
        />
      )}
      {caption ? (
        <img
          className="module-image__caption-icon"
          src="images/caption-shadow.svg"
          alt={window.i18n('imageCaptionIconAlt')}
          onDragStart={disableDrag}
        />
      ) : null}
      <StyledOverlay
        className={classNames(softCorners ? 'module-image--soft-corners' : null)}
        darkOverlay={darkOverlay}
        softCorners={softCorners}
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
      {!(pending || loading) && playIconOverlay ? (
        <div className="module-image__play-overlay__circle">
          <div className="module-image__play-overlay__icon" />
        </div>
      ) : null}
      {overlayText ? (
        <div className="module-image__text-container" style={{ lineHeight: height }}>
          {overlayText}
        </div>
      ) : null}
    </div>
  );
};
