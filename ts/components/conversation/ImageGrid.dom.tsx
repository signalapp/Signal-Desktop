// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment.std.ts';
import {
  areAllAttachmentsVisual,
  getAlt,
  getImageDimensionsForTimeline,
  getThumbnailUrl,
  getUrl,
  isDownloadable,
  isIncremental,
  isVideoAttachment,
} from '../../util/Attachment.std.ts';

import { Image, CurveType } from './Image.dom.tsx';

import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import { AttachmentDetailPill } from './AttachmentDetailPill.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';

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
}: Props): React.JSX.Element | null {
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
    (attachmentIndex: number) => {
      const attachment = attachments[attachmentIndex];
      strictAssert(attachment, 'Missing attachment');
      return attachment.isPermanentlyUndownloadable
        ? showMediaNoLongerAvailableToast
        : showVisualAttachment;
    },
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
    const [attachment] = attachments;
    strictAssert(attachment, 'Missing attachment');
    const { height, width } = getImageDimensionsForTimeline(
      attachment,
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
          alt={getAlt(attachment, i18n)}
          i18n={i18n}
          theme={theme}
          blurHash={attachment.blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={isSticker}
          noBackground={isSticker}
          curveTopLeft={curveTopLeft}
          curveTopRight={curveTopRight}
          curveBottomLeft={curveBottomLeft}
          curveBottomRight={curveBottomRight}
          attachment={attachment}
          playIconOverlay={isVideoAttachment(attachment)}
          height={height}
          width={width}
          url={getUrl(attachment) ?? attachment.thumbnailFromBackup?.url}
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
    const [attachment1, attachment2] = attachments;
    strictAssert(attachment1, 'Missing attachment 1');
    strictAssert(attachment2, 'Missing attachment 2');
    return (
      <div className="module-image-grid">
        <Image
          alt={getAlt(attachment1, i18n)}
          i18n={i18n}
          theme={theme}
          attachment={attachment1}
          blurHash={attachment1.blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={false}
          curveTopLeft={curveTopLeft}
          curveBottomLeft={curveBottomLeft}
          playIconOverlay={isVideoAttachment(attachment1)}
          height={150}
          width={150}
          cropWidth={GAP}
          url={getThumbnailUrl(attachment1)}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
          cancelDownload={cancelDownload}
          startDownload={downloadPill ? undefined : startDownload}
          fallbackToBlurhashOnError
        />
        <Image
          alt={getAlt(attachment2, i18n)}
          i18n={i18n}
          theme={theme}
          blurHash={attachment2.blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={false}
          curveTopRight={curveTopRight}
          curveBottomRight={curveBottomRight}
          playIconOverlay={isVideoAttachment(attachment2)}
          height={150}
          width={150}
          attachment={attachment2}
          url={getThumbnailUrl(attachment2)}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(1)}
          cancelDownload={cancelDownload}
          startDownload={downloadPill ? undefined : startDownload}
          fallbackToBlurhashOnError
        />
        {detailPill}
        {downloadPill}
      </div>
    );
  }

  if (attachments.length === 3) {
    const [attachment1, attachment2, attachment3] = attachments;
    strictAssert(attachment1, 'Missing attachment 1');
    strictAssert(attachment2, 'Missing attachment 2');
    strictAssert(attachment3, 'Missing attachment 3');
    return (
      <div className="module-image-grid">
        <Image
          alt={getAlt(attachment1, i18n)}
          i18n={i18n}
          theme={theme}
          blurHash={attachment1.blurHash}
          bottomOverlay={withBottomOverlay}
          noBorder={false}
          curveTopLeft={curveTopLeft}
          curveBottomLeft={curveBottomLeft}
          attachment={attachment1}
          playIconOverlay={isVideoAttachment(attachment1)}
          height={200}
          width={200}
          cropWidth={GAP}
          url={getUrl(attachment1)}
          showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
          cancelDownload={cancelDownload}
          startDownload={downloadPill ? undefined : startDownload}
          fallbackToBlurhashOnError
        />
        <div className="module-image-grid__column">
          <Image
            alt={getAlt(attachment2, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment2.blurHash}
            curveTopRight={curveTopRight}
            height={100}
            width={100}
            cropHeight={GAP}
            attachment={attachment2}
            playIconOverlay={isVideoAttachment(attachment2)}
            url={getThumbnailUrl(attachment2)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showAttachmentOrNoLongerAvailableToast(1)}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            fallbackToBlurhashOnError
          />
          <Image
            alt={getAlt(attachment3, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment3.blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={false}
            curveBottomRight={curveBottomRight}
            height={100}
            width={100}
            attachment={attachment3}
            playIconOverlay={isVideoAttachment(attachment3)}
            url={getThumbnailUrl(attachment3)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showAttachmentOrNoLongerAvailableToast(2)}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            fallbackToBlurhashOnError
          />
        </div>
        {detailPill}
        {downloadPill}
      </div>
    );
  }

  if (attachments.length === 4) {
    const [attachment1, attachment2, attachment3, attachment4] = attachments;
    strictAssert(attachment1, 'Missing attachment 1');
    strictAssert(attachment2, 'Missing attachment 2');
    strictAssert(attachment3, 'Missing attachment 3');
    strictAssert(attachment4, 'Missing attachment 4');
    return (
      <div className="module-image-grid">
        <div className="module-image-grid__column">
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachment1, i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachment1.blurHash}
              curveTopLeft={curveTopLeft}
              noBorder={false}
              attachment={attachment1}
              playIconOverlay={isVideoAttachment(attachment1)}
              height={150}
              width={150}
              cropHeight={GAP}
              cropWidth={GAP}
              url={getThumbnailUrl(attachment1)}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(0)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              fallbackToBlurhashOnError
            />
            <Image
              alt={getAlt(attachment2, i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachment2.blurHash}
              curveTopRight={curveTopRight}
              playIconOverlay={isVideoAttachment(attachment2)}
              noBorder={false}
              height={150}
              width={150}
              cropHeight={GAP}
              attachment={attachment2}
              url={getThumbnailUrl(attachment2)}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(1)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              fallbackToBlurhashOnError
            />
          </div>
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachment3, i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachment3.blurHash}
              bottomOverlay={withBottomOverlay}
              noBorder={false}
              curveBottomLeft={curveBottomLeft}
              playIconOverlay={isVideoAttachment(attachment3)}
              height={150}
              width={150}
              cropWidth={GAP}
              attachment={attachment3}
              url={getThumbnailUrl(attachment3)}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(2)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              fallbackToBlurhashOnError
            />
            <Image
              alt={getAlt(attachment4, i18n)}
              i18n={i18n}
              theme={theme}
              blurHash={attachment4.blurHash}
              bottomOverlay={withBottomOverlay}
              noBorder={false}
              curveBottomRight={curveBottomRight}
              playIconOverlay={isVideoAttachment(attachment4)}
              height={150}
              width={150}
              attachment={attachment4}
              url={getThumbnailUrl(attachment4)}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              showVisualAttachment={showAttachmentOrNoLongerAvailableToast(3)}
              cancelDownload={cancelDownload}
              startDownload={downloadPill ? undefined : startDownload}
              fallbackToBlurhashOnError
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

  const [attachment1, attachment2, attachment3, attachment4, attachment5] =
    attachments;
  strictAssert(attachment1, 'Missing attachment 1');
  strictAssert(attachment2, 'Missing attachment 2');
  strictAssert(attachment3, 'Missing attachment 3');
  strictAssert(attachment4, 'Missing attachment 4');
  strictAssert(attachment5, 'Missing attachment 4');

  return (
    <div className="module-image-grid">
      <div className="module-image-grid__column">
        <div className="module-image-grid__row">
          <Image
            alt={getAlt(attachment1, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment1.blurHash}
            curveTopLeft={curveTopLeft}
            attachment={attachment1}
            playIconOverlay={isVideoAttachment(attachment1)}
            height={150}
            width={150}
            cropWidth={GAP}
            url={getThumbnailUrl(attachment1)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            fallbackToBlurhashOnError
          />
          <Image
            alt={getAlt(attachment2, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment2.blurHash}
            curveTopRight={curveTopRight}
            playIconOverlay={isVideoAttachment(attachment2)}
            height={150}
            width={150}
            attachment={attachment2}
            url={getThumbnailUrl(attachment2)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            fallbackToBlurhashOnError
          />
        </div>
        <div className="module-image-grid__row">
          <Image
            alt={getAlt(attachment3, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment3.blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            curveBottomLeft={curveBottomLeft}
            playIconOverlay={isVideoAttachment(attachment3)}
            height={100}
            width={100}
            cropWidth={GAP}
            attachment={attachment3}
            url={getThumbnailUrl(attachment3)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            fallbackToBlurhashOnError
          />
          <Image
            alt={getAlt(attachment4, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment4.blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            playIconOverlay={isVideoAttachment(attachment4)}
            height={100}
            width={100}
            cropWidth={GAP}
            attachment={attachment4}
            url={getThumbnailUrl(attachment4)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={cancelDownload}
            startDownload={downloadPill ? undefined : startDownload}
            fallbackToBlurhashOnError
          />
          <Image
            alt={getAlt(attachment5, i18n)}
            i18n={i18n}
            theme={theme}
            blurHash={attachment5.blurHash}
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            curveBottomRight={curveBottomRight}
            playIconOverlay={isVideoAttachment(attachment5)}
            height={100}
            width={100}
            darkOverlay={moreMessagesOverlay}
            overlayText={moreMessagesOverlayText}
            attachment={attachment5}
            url={getThumbnailUrl(attachment5)}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            showVisualAttachment={showVisualAttachment}
            cancelDownload={undefined}
            startDownload={undefined}
            fallbackToBlurhashOnError
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
}): React.JSX.Element | null {
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
