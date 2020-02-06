import React from 'react';
import classNames from 'classnames';

import { Spinner } from '../Spinner';
import { LocalizerType } from '../../types/Util';
import { AttachmentType } from '../../types/Attachment';

interface Props {
  alt: string;
  attachment: AttachmentType;
  url: string;

  height?: number;
  width?: number;

  overlayText?: string;

  bottomOverlay?: boolean;
  closeButton?: boolean;
  curveBottomLeft?: boolean;
  curveBottomRight?: boolean;
  curveTopLeft?: boolean;
  curveTopRight?: boolean;

  smallCurveTopLeft?: boolean;

  darkOverlay?: boolean;
  playIconOverlay?: boolean;
  softCorners?: boolean;

  i18n: LocalizerType;
  onClick?: (attachment: AttachmentType) => void;
  onClickClose?: (attachment: AttachmentType) => void;
  onError?: () => void;
}

export class Image extends React.Component<Props> {
  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  public render() {
    const {
      alt,
      attachment,
      bottomOverlay,
      closeButton,
      curveBottomLeft,
      curveBottomRight,
      curveTopLeft,
      curveTopRight,
      darkOverlay,
      height,
      i18n,
      onClick,
      onClickClose,
      onError,
      overlayText,
      playIconOverlay,
      smallCurveTopLeft,
      softCorners,
      url,
      width,
    } = this.props;

    const { caption, pending } = attachment || { caption: null, pending: true };
    const canClick = onClick && !pending;
    const role = canClick ? 'button' : undefined;

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
          curveBottomLeft ? 'module-image--curved-bottom-left' : null,
          curveBottomRight ? 'module-image--curved-bottom-right' : null,
          curveTopLeft ? 'module-image--curved-top-left' : null,
          curveTopRight ? 'module-image--curved-top-right' : null,
          smallCurveTopLeft ? 'module-image--small-curved-top-left' : null,
          softCorners ? 'module-image--soft-corners' : null
        )}
      >
        {pending ? (
          <div
            className="module-image__loading-placeholder"
            style={{
              height: `${height}px`,
              width: `${width}px`,
              lineHeight: `${height}px`,
              textAlign: 'center',
            }}
            // alt={i18n('loading')}
          >
            <Spinner size="normal" />
          </div>
        ) : (
          <img
            onError={onError}
            className="module-image__image"
            alt={alt}
            height={height}
            width={width}
            src={url}
          />
        )}
        {caption ? (
          <img
            className="module-image__caption-icon"
            src="images/caption-shadow.svg"
            alt={i18n('imageCaptionIconAlt')}
          />
        ) : null}
        <div
          className={classNames(
            'module-image__border-overlay',
            curveTopLeft ? 'module-image--curved-top-left' : null,
            curveTopRight ? 'module-image--curved-top-right' : null,
            curveBottomLeft ? 'module-image--curved-bottom-left' : null,
            curveBottomRight ? 'module-image--curved-bottom-right' : null,
            smallCurveTopLeft ? 'module-image--small-curved-top-left' : null,
            softCorners ? 'module-image--soft-corners' : null,
            darkOverlay ? 'module-image__border-overlay--dark' : null
          )}
        />
        {closeButton ? (
          <div
            role="button"
            onClick={(e: React.MouseEvent<{}>) => {
              e.stopPropagation();
              if (onClickClose) {
                onClickClose(attachment);
              }
            }}
            className="module-image__close-button"
          />
        ) : null}
        {bottomOverlay ? (
          <div
            className={classNames(
              'module-image__bottom-overlay',
              curveBottomLeft ? 'module-image--curved-bottom-left' : null,
              curveBottomRight ? 'module-image--curved-bottom-right' : null
            )}
          />
        ) : null}
        {!pending && playIconOverlay ? (
          <div className="module-image__play-overlay__circle">
            <div className="module-image__play-overlay__icon" />
          </div>
        ) : null}
        {overlayText ? (
          <div
            className="module-image__text-container"
            style={{ lineHeight: `${height}px` }}
          >
            {overlayText}
          </div>
        ) : null}
      </div>
    );
  }
}
