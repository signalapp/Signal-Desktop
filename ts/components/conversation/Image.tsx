// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import { Spinner } from '../Spinner';
import { LocalizerType, ThemeType } from '../../types/Util';
import { AttachmentType, hasNotDownloaded } from '../../types/Attachment';

export type Props = {
  alt: string;
  attachment: AttachmentType;
  url?: string;

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
  blurHash?: string;

  i18n: LocalizerType;
  theme?: ThemeType;
  onClick?: (attachment: AttachmentType) => void;
  onClickClose?: (attachment: AttachmentType) => void;
  onError?: () => void;
};

export class Image extends React.Component<Props> {
  private canClick() {
    const { onClick, attachment } = this.props;
    const { pending } = attachment || { pending: true };

    return Boolean(onClick && !pending);
  }

  public handleClick = (event: React.MouseEvent): void => {
    if (!this.canClick()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    const { onClick, attachment } = this.props;

    if (onClick) {
      event.preventDefault();
      event.stopPropagation();

      onClick(attachment);
    }
  };

  public handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ): void => {
    if (!this.canClick()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    const { onClick, attachment } = this.props;

    if (onClick && (event.key === 'Enter' || event.key === 'Space')) {
      event.preventDefault();
      event.stopPropagation();
      onClick(attachment);
    }
  };

  public renderPending = (): JSX.Element => {
    const { blurHash, height, i18n, width } = this.props;

    if (blurHash) {
      return (
        <div className="module-image__download-pending">
          <Blurhash
            hash={blurHash}
            width={width}
            height={height}
            style={{ display: 'block' }}
          />
          <div className="module-image__download-pending--spinner-container">
            <div
              className="module-image__download-pending--spinner"
              title={i18n('loading')}
            >
              <Spinner moduleClassName="module-image-spinner" svgSize="small" />
            </div>
          </div>
        </div>
      );
    }

    return (
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
    );
  };

  public render(): JSX.Element {
    const {
      alt,
      attachment,
      blurHash,
      bottomOverlay,
      closeButton,
      curveBottomLeft,
      curveBottomRight,
      curveTopLeft,
      curveTopRight,
      darkOverlay,
      height = 0,
      i18n,
      noBackground,
      noBorder,
      onClickClose,
      onError,
      overlayText,
      playIconOverlay,
      smallCurveTopLeft,
      softCorners,
      tabIndex,
      theme,
      url,
      width = 0,
    } = this.props;

    const { caption, pending } = attachment || { caption: null, pending: true };
    const canClick = this.canClick();
    const imgNotDownloaded = hasNotDownloaded(attachment);

    const defaulBlurHash =
      theme === ThemeType.dark
        ? 'L05OQnoffQofoffQfQfQfQfQfQfQ'
        : 'L1Q]+w-;fQ-;~qfQfQfQfQfQfQfQ';
    const resolvedBlurHash = blurHash || defaulBlurHash;

    const overlayClassName = classNames('module-image__border-overlay', {
      'module-image__border-overlay--with-border': !noBorder,
      'module-image__border-overlay--with-click-handler': canClick,
      'module-image--curved-top-left': curveTopLeft,
      'module-image--curved-top-right': curveTopRight,
      'module-image--curved-bottom-left': curveBottomLeft,
      'module-image--curved-bottom-right': curveBottomRight,
      'module-image--small-curved-top-left': smallCurveTopLeft,
      'module-image--soft-corners': softCorners,
      'module-image__border-overlay--dark': darkOverlay,
      'module-image--not-downloaded': imgNotDownloaded,
    });

    const overlay = canClick ? (
      // Not sure what this button does.
      // eslint-disable-next-line jsx-a11y/control-has-associated-label
      <button
        type="button"
        className={overlayClassName}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        tabIndex={tabIndex}
      >
        {imgNotDownloaded ? <i /> : null}
      </button>
    ) : null;

    /* eslint-disable no-nested-ternary */
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
          this.renderPending()
        ) : url ? (
          <img
            onError={onError}
            className="module-image__image"
            alt={alt}
            height={height}
            width={width}
            src={url}
          />
        ) : resolvedBlurHash ? (
          <Blurhash
            hash={resolvedBlurHash}
            width={width}
            height={height}
            style={{ display: 'block' }}
          />
        ) : null}
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
            type="button"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();

              if (onClickClose) {
                onClickClose(attachment);
              }
            }}
            className="module-image__close-button"
            title={i18n('remove-attachment')}
            aria-label={i18n('remove-attachment')}
          />
        ) : null}
      </div>
    );
    /* eslint-enable no-nested-ternary */
  }
}
