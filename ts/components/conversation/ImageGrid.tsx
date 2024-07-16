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
  isVideoAttachment,
} from '../../types/Attachment';

import { Image, CurveType } from './Image';

import type { LocalizerType, ThemeType } from '../../types/Util';

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
  onClick?: (attachment: AttachmentType) => void;
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
  onClick,
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

  if (!attachments || !attachments.length) {
    return null;
  }

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
          onClick={onClick}
          onError={onError}
        />
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
          onClick={onClick}
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
          onClick={onClick}
          onError={onError}
        />
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
          onClick={onClick}
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
            onClick={onClick}
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
            onClick={onClick}
            onError={onError}
          />
        </div>
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
              onClick={onClick}
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
              onClick={onClick}
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
              onClick={onClick}
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
              onClick={onClick}
              onError={onError}
            />
          </div>
        </div>
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
            onClick={onClick}
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
            onClick={onClick}
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
            onClick={onClick}
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
            onClick={onClick}
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
            onClick={onClick}
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
