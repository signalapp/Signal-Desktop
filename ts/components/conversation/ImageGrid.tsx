import React from 'react';
import classNames from 'classnames';

import {
  areAllAttachmentsVisual,
  AttachmentType,
  getAlt,
  getImageDimensions,
  getThumbnailUrl,
  getUrl,
  isVideoAttachment,
} from '../../types/Attachment';

import { Image } from './Image';

import { LocalizerType } from '../../types/Util';

interface Props {
  attachments: Array<AttachmentType>;
  direction?: 'incoming' | 'outgoing';
  isFirstInCluster?: boolean;
  isLastInCluster?: boolean;
  withContentAbove?: boolean;
  withContentBelow?: boolean;
  bottomOverlay?: boolean;
  isSticker?: boolean;
  stickerSize?: number;
  tabIndex?: number;

  i18n: LocalizerType;

  onError: () => void;
  onClick?: (attachment: AttachmentType) => void;
}

export class ImageGrid extends React.Component<Props> {
  // tslint:disable-next-line cyclomatic-complexity max-func-body-length
  public render() {
    const {
      attachments,
      direction,
      bottomOverlay,
      i18n,
      isSticker,
      stickerSize,
      onError,
      onClick,
      tabIndex,
      withContentAbove,
      withContentBelow,
    } = this.props;

    // Assume undefined is true for curving purposes
    const isFirstInCluster = this.props.isFirstInCluster !== false;
    const isLastInCluster = this.props.isLastInCluster !== false;

    // Curve an image corner...
    // ...never if there is content above/below.
    // ...tiny if it is an outside corner with a clustered message above/below.
    // ...regular otherwise.
    const curveTopLeft =
      !Boolean(withContentAbove) &&
      (direction !== 'incoming' || isFirstInCluster);
    const tinyCurveTopLeft =
      !Boolean(withContentAbove) &&
      direction === 'incoming' &&
      !isFirstInCluster;
    const curveTopRight =
      !Boolean(withContentAbove) &&
      (direction !== 'outgoing' || isFirstInCluster);
    const tinyCurveTopRight =
      !Boolean(withContentAbove) &&
      direction === 'outgoing' &&
      !isFirstInCluster;
    const curveBottomLeft =
      !Boolean(withContentBelow) &&
      (direction !== 'incoming' || isLastInCluster);
    const tinyCurveBottomLeft =
      !Boolean(withContentAbove) &&
      direction === 'incoming' &&
      !isLastInCluster;
    const curveBottomRight =
      !Boolean(withContentBelow) &&
      (direction !== 'outgoing' || isLastInCluster);
    const tinyCurveBottomRight =
      !Boolean(withContentAbove) &&
      direction === 'outgoing' &&
      !isLastInCluster;

    const withBottomOverlay = Boolean(
      bottomOverlay && !Boolean(withContentBelow)
    );

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
            bottomOverlay={withBottomOverlay}
            noBorder={isSticker}
            noBackground={isSticker}
            curveTopLeft={curveTopLeft}
            curveTopRight={curveTopRight}
            curveBottomLeft={curveBottomLeft}
            curveBottomRight={curveBottomRight}
            tinyCurveTopLeft={tinyCurveTopLeft}
            tinyCurveTopRight={tinyCurveTopRight}
            tinyCurveBottomLeft={tinyCurveBottomLeft}
            tinyCurveBottomRight={tinyCurveBottomRight}
            attachment={attachments[0]}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={height}
            width={width}
            url={getUrl(attachments[0])}
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
            attachment={attachments[0]}
            bottomOverlay={withBottomOverlay}
            noBorder={false}
            curveTopLeft={curveTopLeft}
            curveBottomLeft={curveBottomLeft}
            tinyCurveTopLeft={tinyCurveTopLeft}
            tinyCurveBottomLeft={tinyCurveBottomLeft}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={149}
            width={149}
            url={getThumbnailUrl(attachments[0])}
            onClick={onClick}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[1], i18n)}
            i18n={i18n}
            bottomOverlay={withBottomOverlay}
            noBorder={false}
            curveTopRight={curveTopRight}
            curveBottomRight={curveBottomRight}
            tinyCurveTopRight={tinyCurveTopRight}
            tinyCurveBottomRight={tinyCurveBottomRight}
            playIconOverlay={isVideoAttachment(attachments[1])}
            height={149}
            width={149}
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
            bottomOverlay={withBottomOverlay}
            noBorder={false}
            curveTopLeft={curveTopLeft}
            curveBottomLeft={curveBottomLeft}
            tinyCurveTopLeft={tinyCurveTopLeft}
            tinyCurveBottomLeft={tinyCurveBottomLeft}
            attachment={attachments[0]}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={200}
            width={199}
            url={getUrl(attachments[0])}
            onClick={onClick}
            onError={onError}
          />
          <div className="module-image-grid__column">
            <Image
              alt={getAlt(attachments[1], i18n)}
              i18n={i18n}
              curveTopRight={curveTopRight}
              tinyCurveTopRight={tinyCurveTopRight}
              height={99}
              width={99}
              attachment={attachments[1]}
              playIconOverlay={isVideoAttachment(attachments[1])}
              url={getThumbnailUrl(attachments[1])}
              onClick={onClick}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[2], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              noBorder={false}
              curveBottomRight={curveBottomRight}
              tinyCurveBottomRight={tinyCurveBottomRight}
              height={99}
              width={99}
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
                curveTopLeft={curveTopLeft}
                tinyCurveTopLeft={tinyCurveTopLeft}
                noBorder={false}
                attachment={attachments[0]}
                playIconOverlay={isVideoAttachment(attachments[0])}
                height={149}
                width={149}
                url={getThumbnailUrl(attachments[0])}
                onClick={onClick}
                onError={onError}
              />
              <Image
                alt={getAlt(attachments[1], i18n)}
                i18n={i18n}
                curveTopRight={curveTopRight}
                tinyCurveTopRight={tinyCurveTopRight}
                playIconOverlay={isVideoAttachment(attachments[1])}
                noBorder={false}
                height={149}
                width={149}
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
                bottomOverlay={withBottomOverlay}
                noBorder={false}
                curveBottomLeft={curveBottomLeft}
                tinyCurveBottomLeft={tinyCurveBottomLeft}
                playIconOverlay={isVideoAttachment(attachments[2])}
                height={149}
                width={149}
                attachment={attachments[2]}
                url={getThumbnailUrl(attachments[2])}
                onClick={onClick}
                onError={onError}
              />
              <Image
                alt={getAlt(attachments[3], i18n)}
                i18n={i18n}
                bottomOverlay={withBottomOverlay}
                noBorder={false}
                curveBottomRight={curveBottomRight}
                tinyCurveBottomRight={tinyCurveBottomRight}
                playIconOverlay={isVideoAttachment(attachments[3])}
                height={149}
                width={149}
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
              curveTopLeft={curveTopLeft}
              tinyCurveTopLeft={tinyCurveTopLeft}
              attachment={attachments[0]}
              playIconOverlay={isVideoAttachment(attachments[0])}
              height={149}
              width={149}
              url={getThumbnailUrl(attachments[0])}
              onClick={onClick}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[1], i18n)}
              i18n={i18n}
              curveTopRight={curveTopRight}
              tinyCurveTopRight={tinyCurveTopRight}
              playIconOverlay={isVideoAttachment(attachments[1])}
              height={149}
              width={149}
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
              bottomOverlay={withBottomOverlay}
              noBorder={isSticker}
              curveBottomLeft={curveBottomLeft}
              tinyCurveBottomLeft={tinyCurveBottomLeft}
              playIconOverlay={isVideoAttachment(attachments[2])}
              height={99}
              width={99}
              attachment={attachments[2]}
              url={getThumbnailUrl(attachments[2])}
              onClick={onClick}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[3], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              noBorder={isSticker}
              playIconOverlay={isVideoAttachment(attachments[3])}
              height={99}
              width={98}
              attachment={attachments[3]}
              url={getThumbnailUrl(attachments[3])}
              onClick={onClick}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[4], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              noBorder={isSticker}
              curveBottomRight={curveBottomRight}
              tinyCurveBottomRight={tinyCurveBottomRight}
              playIconOverlay={isVideoAttachment(attachments[4])}
              height={99}
              width={99}
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
}
