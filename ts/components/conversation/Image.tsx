// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import { Spinner } from '../Spinner';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { AttachmentType } from '../../types/Attachment';
import {
  isDownloaded as isDownloadedFunction,
  defaultBlurHash,
} from '../../types/Attachment';

export enum CurveType {
  None = 0,
  Tiny = 4,
  Small = 10,
  Normal = 18,
}

export type Props = {
  alt: string;
  attachment: AttachmentType;
  url?: string;

  isDownloaded?: boolean;
  className?: string;
  height?: number;
  width?: number;
  cropWidth?: number;
  cropHeight?: number;
  tabIndex?: number;

  overlayText?: string;

  noBorder?: boolean;
  noBackground?: boolean;
  bottomOverlay?: boolean;
  closeButton?: boolean;
  curveBottomLeft?: CurveType;
  curveBottomRight?: CurveType;
  curveTopLeft?: CurveType;
  curveTopRight?: CurveType;

  darkOverlay?: boolean;
  playIconOverlay?: boolean;
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

  public override render(): JSX.Element {
    const {
      alt,
      attachment,
      blurHash,
      bottomOverlay,
      className,
      closeButton,
      curveBottomLeft,
      curveBottomRight,
      curveTopLeft,
      curveTopRight,
      darkOverlay,
      isDownloaded,
      height = 0,
      i18n,
      noBackground,
      noBorder,
      onClickClose,
      onError,
      overlayText,
      playIconOverlay,
      tabIndex,
      theme,
      url,
      width = 0,
      cropWidth = 0,
      cropHeight = 0,
    } = this.props;

    const { caption, pending } = attachment || { caption: null, pending: true };
    const canClick = this.canClick();
    const imgNotDownloaded = isDownloaded
      ? false
      : !isDownloadedFunction(attachment);

    const resolvedBlurHash = blurHash || defaultBlurHash(theme);

    const curveStyles = {
      borderTopLeftRadius: curveTopLeft || CurveType.None,
      borderTopRightRadius: curveTopRight || CurveType.None,
      borderBottomLeftRadius: curveBottomLeft || CurveType.None,
      borderBottomRightRadius: curveBottomRight || CurveType.None,
    };

    const overlay = canClick ? (
      // Not sure what this button does.
      <button
        type="button"
        className={classNames('module-image__border-overlay', {
          'module-image__border-overlay--with-border': !noBorder,
          'module-image__border-overlay--with-click-handler': canClick,
          'module-image__border-overlay--dark': darkOverlay,
          'module-image--not-downloaded': imgNotDownloaded,
        })}
        style={curveStyles}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        tabIndex={tabIndex}
      >
        {imgNotDownloaded ? <span /> : null}
      </button>
    ) : null;

    /* eslint-disable no-nested-ternary */
    return (
      <div
        className={classNames(
          'module-image',
          className,
          !noBackground ? 'module-image--with-background' : null,
          cropWidth || cropHeight ? 'module-image--cropped' : null
        )}
        style={{
          width: width - cropWidth,
          height: height - cropHeight,
          ...curveStyles,
        }}
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
            className="module-image__bottom-overlay"
            style={{
              borderBottomLeftRadius: curveBottomLeft || CurveType.None,
              borderBottomRightRadius: curveBottomRight || CurveType.None,
            }}
          />
        ) : null}
        {!pending && !imgNotDownloaded && playIconOverlay ? (
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
