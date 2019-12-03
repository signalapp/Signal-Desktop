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
  tabIndex?: number;

  overlayText?: string;

  noBorder?: boolean;
  noBackground?: boolean;
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
  public handleClick = (event: React.MouseEvent) => {
    const { onClick, attachment } = this.props;

    if (onClick) {
      event.preventDefault();
      event.stopPropagation();

      onClick(attachment);
    }
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const { onClick, attachment } = this.props;

    if (onClick && (event.key === 'Enter' || event.key === 'Space')) {
      event.preventDefault();
      event.stopPropagation();
      onClick(attachment);
    }
  };

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
      noBackground,
      noBorder,
      onClick,
      onClickClose,
      onError,
      overlayText,
      playIconOverlay,
      smallCurveTopLeft,
      softCorners,
      tabIndex,
      url,
      width,
    } = this.props;

    const { caption, pending } = attachment || { caption: null, pending: true };
    const canClick = onClick && !pending;

    const overlayClassName = classNames(
      'module-image__border-overlay',
      noBorder ? null : 'module-image__border-overlay--with-border',
      canClick && onClick
        ? 'module-image__border-overlay--with-click-handler'
        : null,
      curveTopLeft ? 'module-image--curved-top-left' : null,
      curveTopRight ? 'module-image--curved-top-right' : null,
      curveBottomLeft ? 'module-image--curved-bottom-left' : null,
      curveBottomRight ? 'module-image--curved-bottom-right' : null,
      smallCurveTopLeft ? 'module-image--small-curved-top-left' : null,
      softCorners ? 'module-image--soft-corners' : null,
      darkOverlay ? 'module-image__border-overlay--dark' : null
    );

    let overlay;
    if (canClick && onClick) {
      overlay = (
        <button
          className={overlayClassName}
          onClick={this.handleClick}
          onKeyDown={this.handleKeyDown}
          tabIndex={tabIndex}
        />
      );
    } else {
      overlay = <div className={overlayClassName} />;
    }

    return (
      <div
        className={classNames(
          'module-image',
          !noBackground ? 'module-image--with-background' : null,
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
            title={i18n('loading')}
          >
            <Spinner svgSize="normal" />
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
        {overlay}
        {closeButton ? (
          <button
            onClick={(e: React.MouseEvent<{}>) => {
              e.preventDefault();
              e.stopPropagation();

              if (onClickClose) {
                onClickClose(attachment);
              }
            }}
            className="module-image__close-button"
            title={i18n('remove-attachment')}
          />
        ) : null}
      </div>
    );
  }
}
