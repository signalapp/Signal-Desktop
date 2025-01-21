// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import React, { useCallback } from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import { Spinner } from '../Spinner';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment';
import {
  defaultBlurHash,
  isIncremental,
  isPermanentlyUndownloadable,
  isReadyToView,
} from '../../types/Attachment';
import { ProgressCircle } from '../ProgressCircle';
import { useUndownloadableMediaHandler } from '../../hooks/useUndownloadableMediaHandler';

export enum CurveType {
  None = 0,
  Tiny = 4,
  Small = 10,
  Normal = 18,
}

export type Props = {
  alt: string;
  attachment: AttachmentForUIType;
  url?: string;

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
  showMediaNoLongerAvailableToast?: () => void;
  showVisualAttachment?: (attachment: AttachmentType) => void;
  cancelDownload?: () => void;
  startDownload?: () => void;
  onClickClose?: (attachment: AttachmentType) => void;
  onError?: () => void;
};

export function Image({
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
  height = 0,
  i18n,
  noBackground,
  noBorder,
  showMediaNoLongerAvailableToast,
  showVisualAttachment,
  startDownload,
  cancelDownload,
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
}: Props): JSX.Element {
  const resolvedBlurHash = blurHash || defaultBlurHash(theme);

  const curveStyles: CSSProperties = {
    borderStartStartRadius: curveTopLeft || CurveType.None,
    borderStartEndRadius: curveTopRight || CurveType.None,
    borderEndStartRadius: curveBottomLeft || CurveType.None,
    borderEndEndRadius: curveBottomRight || CurveType.None,
  };

  const showVisualAttachmentClick = useCallback(
    (event: React.MouseEvent) => {
      if (showVisualAttachment) {
        event.preventDefault();
        event.stopPropagation();
        showVisualAttachment(attachment);
      }
    },
    [attachment, showVisualAttachment]
  );
  const showVisualAttachmentKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (
        showVisualAttachment &&
        (event.key === 'Enter' || event.key === 'Space')
      ) {
        event.preventDefault();
        event.stopPropagation();
        showVisualAttachment(attachment);
      }
    },
    [attachment, showVisualAttachment]
  );
  const cancelDownloadClick = useCallback(
    (event: React.MouseEvent) => {
      if (cancelDownload) {
        event.preventDefault();
        event.stopPropagation();
        cancelDownload();
      }
    },
    [cancelDownload]
  );
  const cancelDownloadKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (cancelDownload && (event.key === 'Enter' || event.key === 'Space')) {
        event.preventDefault();
        event.stopPropagation();
        cancelDownload();
      }
    },
    [cancelDownload]
  );
  const startDownloadClick = useCallback(
    (event: React.MouseEvent) => {
      if (startDownload) {
        event.preventDefault();
        event.stopPropagation();
        startDownload();
      }
    },
    [startDownload]
  );
  const startDownloadKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (startDownload && (event.key === 'Enter' || event.key === 'Space')) {
        event.preventDefault();
        event.stopPropagation();
        startDownload();
      }
    },
    [startDownload]
  );
  const undownloadableClick = useUndownloadableMediaHandler(
    showMediaNoLongerAvailableToast
  );

  const imageOrBlurHash = url ? (
    <img
      onError={onError}
      className="module-image__image"
      alt={alt}
      height={height}
      width={width}
      src={url}
    />
  ) : (
    <Blurhash
      hash={resolvedBlurHash}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );

  const startDownloadButton =
    !attachment.path && !attachment.pending && !isIncremental(attachment) ? (
      <button
        type="button"
        className="module-image__overlay-circle"
        aria-label={i18n('icu:startDownload')}
        onClick={startDownloadClick}
        onKeyDown={startDownloadKeyDown}
        tabIndex={tabIndex}
      >
        <div className="module-image__download-icon" />
      </button>
    ) : undefined;

  const isUndownloadable = isPermanentlyUndownloadable(attachment);

  // eslint-disable-next-line no-nested-ternary
  const startDownloadOrUnavailableButton = startDownload ? (
    isUndownloadable ? (
      <button
        type="button"
        className="module-image__overlay-circle module-image__overlay-circle--undownloadable"
        aria-label={i18n('icu:mediaNotAvailable')}
        onClick={undownloadableClick}
        tabIndex={tabIndex}
      >
        <div className="module-image__undownloadable-icon" />
      </button>
    ) : (
      startDownloadButton
    )
  ) : null;

  const spinner =
    isIncremental(attachment) || !cancelDownload
      ? undefined
      : getSpinner({
          attachment,
          i18n,
          cancelDownloadClick,
          cancelDownloadKeyDown,
          tabIndex,
        });

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
      {imageOrBlurHash}
      {startDownloadOrUnavailableButton}
      {spinner}

      {attachment.caption ? (
        <img
          className="module-image__caption-icon"
          src="images/caption-shadow.svg"
          alt={i18n('icu:imageCaptionIconAlt')}
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
      {(attachment.path || isIncremental(attachment)) &&
      !isUndownloadable &&
      playIconOverlay ? (
        <div className="module-image__overlay-circle">
          <div className="module-image__play-icon" />
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
      {darkOverlay || !noBorder ? (
        <div
          className={classNames('module-image__border-overlay', {
            'module-image__border-overlay--with-border': !noBorder,
            'module-image__border-overlay--dark': darkOverlay,
          })}
          style={curveStyles}
        />
      ) : null}
      {showVisualAttachment && isReadyToView(attachment) ? (
        <button
          type="button"
          className={classNames('module-image__border-overlay', {
            'module-image__border-overlay--with-click-handler': true,
          })}
          aria-label={i18n('icu:imageOpenAlt')}
          style={curveStyles}
          onClick={showVisualAttachmentClick}
          onKeyDown={showVisualAttachmentKeyDown}
          tabIndex={tabIndex}
        />
      ) : null}
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
          title={i18n('icu:remove-attachment')}
          aria-label={i18n('icu:remove-attachment')}
        />
      ) : null}
    </div>
  );
}

export function getSpinner({
  attachment,
  cancelDownloadClick,
  cancelDownloadKeyDown,
  i18n,
  tabIndex,
}: {
  attachment: AttachmentForUIType;
  cancelDownloadClick: (event: React.MouseEvent) => void;
  cancelDownloadKeyDown: (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => void;
  i18n: LocalizerType;
  tabIndex: number | undefined;
}): JSX.Element | undefined {
  const downloadFraction =
    attachment.pending &&
    !isIncremental(attachment) &&
    attachment.size &&
    attachment.totalDownloaded
      ? attachment.totalDownloaded / attachment.size
      : undefined;

  if (downloadFraction) {
    return (
      <button
        type="button"
        className="module-image__overlay-circle"
        aria-label={i18n('icu:cancelDownload')}
        onClick={cancelDownloadClick}
        onKeyDown={cancelDownloadKeyDown}
        tabIndex={tabIndex}
      >
        <div className="module-image__stop-icon" />
        <div className="module-image__progress-circle-wrapper">
          <ProgressCircle
            fractionComplete={downloadFraction}
            width={44}
            strokeWidth={2}
          />
        </div>
      </button>
    );
  }

  if (!attachment.pending) {
    return undefined;
  }

  return (
    <button
      type="button"
      className="module-image__overlay-circle"
      aria-label={i18n('icu:cancelDownload')}
      onClick={cancelDownloadClick}
      onKeyDown={cancelDownloadKeyDown}
      tabIndex={tabIndex}
    >
      <div className="module-image__spinner-container">
        <Spinner
          moduleClassName="module-image-spinner"
          svgSize="normal"
          size="44px"
        />
        <div className="module-image__stop-icon" />
      </div>
    </button>
  );
}
