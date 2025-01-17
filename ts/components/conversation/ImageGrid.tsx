// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment';
import {
  areAllAttachmentsVisual,
  getAlt,
  getImageDimensions,
  getThumbnailUrl,
  getUrl,
  isDownloadable,
  isIncremental,
  isPermanentlyUndownloadable,
  isVideoAttachment,
} from '../../types/Attachment';

import { Image, CurveType } from './Image';

import type { LocalizerType, ThemeType } from '../../types/Util';
import { AttachmentDetailPill } from './AttachmentDetailPill';

export type DirectionType = 'incoming' | 'outgoing';

export type Props = {
  attachments: ReadonlyArray<AttachmentForUIType>;
  bottomOverlay?: boolean;
  direction: DirectionType;
  isSticker?: boolean;
  shouldCollapseAbove?: boolean;
  shouldCollapseBelow?: boolean;
  stickerSize?: number;
  tabIndex?: number;
  withContentAbove?: boolean;
  withContentBelow?: boolean;

  i18n: LocalizerType;
  theme?: ThemeType;

  onError: () => void;
  showVisualAttachment: (attachment: AttachmentType) => void;
  showMediaNoLongerAvailableToast: () => void;
  cancelDownload: () => void;
  startDownload: () => void;
};

const GAP = 1;

function getCurves({
  direction,
  shouldCollapseAbove,
  shouldCollapseBelow,
  withContentAbove,
  withContentBelow,
}: {
  direction: DirectionType;
  shouldCollapseAbove?: boolean;
  shouldCollapseBelow?: boolean;
  withContentAbove?: boolean;
  withContentBelow?: boolean;
}): {
  curveTopLeft: CurveType;
  curveTopRight: CurveType;
  curveBottomLeft: CurveType;
  curveBottomRight: CurveType;
} {
  let curveTopLeft = CurveType.None;
  let curveTopRight = CurveType.None;
  let curveBottomLeft = CurveType.None;
  let curveBottomRight = CurveType.None;

  if (shouldCollapseAbove && direction === 'incoming') {
    curveTopLeft = CurveType.Tiny;
    curveTopRight = CurveType.Normal;
  } else if (shouldCollapseAbove && direction === 'outgoing') {
    curveTopLeft = CurveType.Normal;
    curveTopRight = CurveType.Tiny;
  } else if (!withContentAbove) {
    curveTopLeft = CurveType.Normal;
    curveTopRight = CurveType.Normal;
  }

  if (withContentBelow) {
    curveBottomLeft = CurveType.None;
    curveBottomRight = CurveType.None;
  } else if (shouldCollapseBelow && direction === 'incoming') {
    curveBottomLeft = CurveType.Tiny;
    curveBottomRight = CurveType.None;
  } else if (shouldCollapseBelow && direction === 'outgoing') {
    curveBottomLeft = CurveType.None;
    curveBottomRight = CurveType.Tiny;
  } else {
    curveBottomLeft = CurveType.Normal;
    curveBottomRight = CurveType.Normal;
  }

  return {
    curveTopLeft,
    curveTopRight,
    curveBottomLeft,
    curveBottomRight,
  };
}

export function ImageGrid({
  attachments,
  bottomOverlay,
  direction,
  i18n,
  isSticker,
  stickerSize,
  onError,
  showMediaNoLongerAvailableToast,
  showVisualAttachment,
  cancelDownload,
  startDownload,
  shouldCollapseAbove,
  shouldCollapseBelow,
  tabIndex,
  theme,
  withContentAbove,
  withContentBelow,
}: Props): JSX.Element | null {
  const { curveTopLeft, curveTopRight, curveBottomLeft, curveBottomRight } =
    getCurves({
      direction,
      shouldCollapseAbove,
      shouldCollapseBelow,
      withContentAbove,
      withContentBelow,
    });

  const withBottomOverlay = Boolean(bottomOverlay && !withContentBelow);

  const startDownloadClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (startDownload) {
        event.preventDefault();
        event.stopPropagation();
        startDownload();
      }
    },
    [startDownload]
  );
  const startDownloadKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (startDownload && (event.key === 'Enter' || event.key === 'Space')) {
        event.preventDefault();
        event.stopPropagation();
        startDownload();
      }
    },
    [startDownload]
  );

  const showAttachmentOrNoLongerAvailableToast = React.useCallback(
    attachmentIndex =>
      isPermanentlyUndownloadable(attachments[attachmentIndex])
        ? showMediaNoLongerAvailableToast
        : showVisualAttachment,
    [attachments, showVisualAttachment, showMediaNoLongerAvailableToast]
  );

  if (!attachments || !attachments.length) {
    return null;
  }

  const downloadableAttachments = attachments.filter(attachment =>
    isDownloadable(attachment)
  );

  const detailPill = (
    <AttachmentDetailPill
      attachments={downloadableAttachments}
      i18n={i18n}
      startDownload={startDownload}
      cancelDownload={cancelDownload}
    />
  );
  const downloadPill = renderDownloadPill({
    attachments,
    i18n,
    startDownloadClick,
    startDownloadKeyDown,
  });

  if (attachments.length === 1 || !areAllAttachmentsVisual(attachments)) {
    const { height, width } = getImageDimensions(
      attachments[0],
      isSticker ? stickerSize : undefined
    );

    return (
      <div
        className={classNames(
          'module-image-grid',
          'module-image-grid--one-image',
          isSticker ? 'module-image-grid--with-sticker' : null
        )}
      >
        <Image
          alt={getAlt(attachments[0], i18n)}
          i18n={i18n}
          theme={theme}
          blurHash={attachments[0].blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={isSticker}
          noBackground={isSticker}
          curveTopLeft={curveTopLeft}
          curveTopRight={curveTopRight}
          curveBottomLeft={curveBottomLeft}
          curveBottomRight={curveBottomRight}
          attachment={attachments[0]}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={height}
          width={width}
          url={
            getUrl(attachments[0]) ?? attachments[0].thumbnailFromBackup?.url
          }
          tabIndex={tabIndex}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
          cancelDownload={cancelDownload}
          startDownload={startDownload}
          onError={onError}
        />
        {detailPill}
      </div>
    );
  }

  if (attachments.length === 2) {
    return (
      <div className="module-image-grid">
        <Image
          alt={getAlt(attachments[0], i18n)}
          i18n={i18n}
          theme={theme}
          attachment={attachments[0]}
          blurHash={attachments[0].blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={false}
          curveTopLeft={curveTopLeft}
          curveBottomLeft={curveBottomLeft}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={150}
          width={150}
          cropWidth={GAP}
          url={getThumbnailUrl(attachments[0])}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
          cancelDownload={cancelDownload}
          startDownload={downloadPill ? undefined : startDownload}
          onError={onError}
        />
        <Image
          alt={getAlt(attachments[1], i18n)}
          i18n={i18n}
          theme={theme}
          blurHash={attachments[1].blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={false}
          curveTopRight={curveTopRight}
          curveBottomRight={curveBottomRight}
          playIconOverlay={isVideoAttachment(attachments[1])}
          height={150}
          width={150}
          attachment={attachments[1]}
          url={getThumbnailUrl(attachments[1])}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(1)}
          cancelDownload={cancelDownload}
          startDownload={downloadPill ? undefined : startDownload}
          onError={onError}
        />
        {detailPill}
        {downloadPill}
      </div>
    );
  }

  if (attachments.length === 3) {
    return (
      <div className="module-image-grid">
        <Image
          alt={getAlt(attachments[0], i18n)}
          i18n={i18n}
          theme={theme}
          blurHash={attachments[0].blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={false}
          curveTopLeft={curveTopLeft}
          curveBottomLeft={curveBottomLeft}
          attachment={attachments[0]}
          playIconOverlay={isVideoAttachment(attachments[0])}
          height={200}
          width={200}
          cropWidth={GAP}
          url={getUrl(attachments[0])}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
          cancelDownload={cancelDownload}
          startDownload={downloadPill ? undefined : startDownload}
          onError={onError}
        />
        <div className="module-image-grid__column">
          <Image
            alt={getAlt(attachments[1], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[1].blurHash}
            curveTopRight={curveTopRight}
            height={100}
            width={100}
            cropHeight={GAP}
            attachment={attachments[1]}
            playIconOverlay={isVideoAttachment(attachments[1])}
            url={getThumbnailUrl(attachments[1])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showAttachmentOrNoLongerAvailableToast(1)}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[2], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[2].blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={false}
            curveBottomRight={curveBottomRight}
            height={100}
            width={100}
            attachment={attachments[2]}
            playIconOverlay={isVideoAttachment(attachments[2])}
            url={getThumbnailUrl(attachments[2])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showAttachmentOrNoLongerAvailableToast(2)}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            onError={onError}
          />
        </div>
        {detailPill}
        {downloadPill}
      </div>
    );
  }

  if (attachments.length === 4) {
    return (
      <div className="module-image-grid">
        <div className="module-image-grid__column">
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachments[0], i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachments[0].blurHash}
              curveTopLeft={curveTopLeft}
              noBorder={false}
              attachment={attachments[0]}
              playIconOverlay={isVideoAttachment(attachments[0])}
              height={150}
              width={150}
              cropHeight={GAP}
              cropWidth={GAP}
              url={getThumbnailUrl(attachments[0])}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[1], i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachments[1].blurHash}
              curveTopRight={curveTopRight}
              playIconOverlay={isVideoAttachment(attachments[1])}
              noBorder={false}
              height={150}
              width={150}
              cropHeight={GAP}
              attachment={attachments[1]}
              url={getThumbnailUrl(attachments[1])}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(1)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              onError={onError}
            />
          </div>
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachments[2], i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachments[2].blurHash}
              bottomOverlay={withBottomOverlay}
              noBorder={false}
              curveBottomLeft={curveBottomLeft}
              playIconOverlay={isVideoAttachment(attachments[2])}
              height={150}
              width={150}
              cropWidth={GAP}
              attachment={attachments[2]}
              url={getThumbnailUrl(attachments[2])}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(2)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[3], i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachments[3].blurHash}
              bottomOverlay={withBottomOverlay}
              noBorder={false}
              curveBottomRight={curveBottomRight}
              playIconOverlay={isVideoAttachment(attachments[3])}
              height={150}
              width={150}
              attachment={attachments[3]}
              url={getThumbnailUrl(attachments[3])}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(3)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              onError={onError}
            />
          </div>
        </div>
        {detailPill}
        {downloadPill}
      </div>
    );
  }

  const moreMessagesOverlay = attachments.length > 5;
  const moreMessagesOverlayText = moreMessagesOverlay
    ? `+${attachments.length - 5}`
    : undefined;

  return (
    <div className="module-image-grid">
      <div className="module-image-grid__column">
        <div className="module-image-grid__row">
          <Image
            alt={getAlt(attachments[0], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[0].blurHash}
            curveTopLeft={curveTopLeft}
            attachment={attachments[0]}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={150}
            width={150}
            cropWidth={GAP}
            url={getThumbnailUrl(attachments[0])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[1], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[1].blurHash}
            curveTopRight={curveTopRight}
            playIconOverlay={isVideoAttachment(attachments[1])}
            height={150}
            width={150}
            attachment={attachments[1]}
            url={getThumbnailUrl(attachments[1])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            onError={onError}
          />
        </div>
        <div className="module-image-grid__row">
          <Image
            alt={getAlt(attachments[2], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[2].blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            curveBottomLeft={curveBottomLeft}
            playIconOverlay={isVideoAttachment(attachments[2])}
            height={100}
            width={100}
            cropWidth={GAP}
            attachment={attachments[2]}
            url={getThumbnailUrl(attachments[2])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[3], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[3].blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            playIconOverlay={isVideoAttachment(attachments[3])}
            height={100}
            width={100}
            cropWidth={GAP}
            attachment={attachments[3]}
            url={getThumbnailUrl(attachments[3])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[4], i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachments[4].blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            curveBottomRight={curveBottomRight}
            playIconOverlay={isVideoAttachment(attachments[4])}
            height={100}
            width={100}
            darkOverlay={moreMessagesOverlay}
            overlayText={moreMessagesOverlayText}
            attachment={attachments[4]}
            url={getThumbnailUrl(attachments[4])}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={undefined}
            startDownload={undefined}
            onError={onError}
          />
        </div>
      </div>
      {detailPill}
      {downloadPill}
    </div>
  );
}

function renderDownloadPill({
  attachments,
  i18n,
  startDownloadClick,
  startDownloadKeyDown,
}: {
  attachments: ReadonlyArray<AttachmentForUIType>;
  i18n: LocalizerType;
  startDownloadClick: (event: React.MouseEvent) => void;
  startDownloadKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}): JSX.Element | null {
  const downloadedOrPendingOrIncremental = attachments.some(
    attachment =>
      attachment.path || attachment.pending || isIncremental(attachment)
  );
  if (downloadedOrPendingOrIncremental) {
    return null;
  }

  const noneDownloadable = !attachments.some(attachment =>
    isDownloadable(attachment)
  );
  if (noneDownloadable) {
    return null;
  }

  return (
    <button
      type="button"
      className="module-image-grid__download-pill"
      aria-label={i18n('icu:startDownload')}
      onClick={startDownloadClick}
      onKeyDown={startDownloadKeyDown}
    >
      <div className="module-image-grid__download_pill__icon-wrapper">
        <div className="module-image-grid__download_pill__download-icon" />
      </div>
      <div className="module-image-grid__download_pill__text-wrapper">
        {i18n('icu:downloadNItems', { count: attachments.length })}
      </div>
    </button>
  );
}
