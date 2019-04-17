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
  withContentAbove?: boolean;
  withContentBelow?: boolean;
  bottomOverlay?: boolean;

  i18n: LocalizerType;

  onError: () => void;
  onClickAttachment?: (attachment: AttachmentType) => void;
}

export class ImageGrid extends React.Component<Props> {
  // tslint:disable-next-line max-func-body-length */
  public render() {
    const {
      attachments,
      bottomOverlay,
      i18n,
      onError,
      onClickAttachment,
      withContentAbove,
      withContentBelow,
    } = this.props;

    const curveTopLeft = !Boolean(withContentAbove);
    const curveTopRight = curveTopLeft;

    const curveBottom = !Boolean(withContentBelow);
    const curveBottomLeft = curveBottom;
    const curveBottomRight = curveBottom;

    const withBottomOverlay = Boolean(bottomOverlay && curveBottom);

    if (!attachments || !attachments.length) {
      return null;
    }

    if (attachments.length === 1 || !areAllAttachmentsVisual(attachments)) {
      const { height, width } = getImageDimensions(attachments[0]);

      return (
        <div
          className={classNames(
            'module-image-grid',
            'module-image-grid--one-image'
          )}
        >
          <Image
            alt={getAlt(attachments[0], i18n)}
            i18n={i18n}
            bottomOverlay={withBottomOverlay}
            curveTopLeft={curveTopLeft}
            curveTopRight={curveTopRight}
            curveBottomLeft={curveBottomLeft}
            curveBottomRight={curveBottomRight}
            attachment={attachments[0]}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={height}
            width={width}
            url={getUrl(attachments[0])}
            onClick={onClickAttachment}
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
            curveTopLeft={curveTopLeft}
            curveBottomLeft={curveBottomLeft}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={149}
            width={149}
            url={getThumbnailUrl(attachments[0])}
            onClick={onClickAttachment}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[1], i18n)}
            i18n={i18n}
            bottomOverlay={withBottomOverlay}
            curveTopRight={curveTopRight}
            curveBottomRight={curveBottomRight}
            playIconOverlay={isVideoAttachment(attachments[1])}
            height={149}
            width={149}
            attachment={attachments[1]}
            url={getThumbnailUrl(attachments[1])}
            onClick={onClickAttachment}
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
            curveTopLeft={curveTopLeft}
            curveBottomLeft={curveBottomLeft}
            attachment={attachments[0]}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={200}
            width={199}
            url={getUrl(attachments[0])}
            onClick={onClickAttachment}
            onError={onError}
          />
          <div className="module-image-grid__column">
            <Image
              alt={getAlt(attachments[1], i18n)}
              i18n={i18n}
              curveTopRight={curveTopRight}
              height={99}
              width={99}
              attachment={attachments[1]}
              playIconOverlay={isVideoAttachment(attachments[1])}
              url={getThumbnailUrl(attachments[1])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[2], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              curveBottomRight={curveBottomRight}
              height={99}
              width={99}
              attachment={attachments[2]}
              playIconOverlay={isVideoAttachment(attachments[2])}
              url={getThumbnailUrl(attachments[2])}
              onClick={onClickAttachment}
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
                attachment={attachments[0]}
                playIconOverlay={isVideoAttachment(attachments[0])}
                height={149}
                width={149}
                url={getThumbnailUrl(attachments[0])}
                onClick={onClickAttachment}
                onError={onError}
              />
              <Image
                alt={getAlt(attachments[1], i18n)}
                i18n={i18n}
                curveTopRight={curveTopRight}
                playIconOverlay={isVideoAttachment(attachments[1])}
                height={149}
                width={149}
                attachment={attachments[1]}
                url={getThumbnailUrl(attachments[1])}
                onClick={onClickAttachment}
                onError={onError}
              />
            </div>
            <div className="module-image-grid__row">
              <Image
                alt={getAlt(attachments[2], i18n)}
                i18n={i18n}
                bottomOverlay={withBottomOverlay}
                curveBottomLeft={curveBottomLeft}
                playIconOverlay={isVideoAttachment(attachments[2])}
                height={149}
                width={149}
                attachment={attachments[2]}
                url={getThumbnailUrl(attachments[2])}
                onClick={onClickAttachment}
                onError={onError}
              />
              <Image
                alt={getAlt(attachments[3], i18n)}
                i18n={i18n}
                bottomOverlay={withBottomOverlay}
                curveBottomRight={curveBottomRight}
                playIconOverlay={isVideoAttachment(attachments[3])}
                height={149}
                width={149}
                attachment={attachments[3]}
                url={getThumbnailUrl(attachments[3])}
                onClick={onClickAttachment}
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
              attachment={attachments[0]}
              playIconOverlay={isVideoAttachment(attachments[0])}
              height={149}
              width={149}
              url={getThumbnailUrl(attachments[0])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[1], i18n)}
              i18n={i18n}
              curveTopRight={curveTopRight}
              playIconOverlay={isVideoAttachment(attachments[1])}
              height={149}
              width={149}
              attachment={attachments[1]}
              url={getThumbnailUrl(attachments[1])}
              onClick={onClickAttachment}
              onError={onError}
            />
          </div>
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachments[2], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              curveBottomLeft={curveBottomLeft}
              playIconOverlay={isVideoAttachment(attachments[2])}
              height={99}
              width={99}
              attachment={attachments[2]}
              url={getThumbnailUrl(attachments[2])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[3], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              playIconOverlay={isVideoAttachment(attachments[3])}
              height={99}
              width={98}
              attachment={attachments[3]}
              url={getThumbnailUrl(attachments[3])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[4], i18n)}
              i18n={i18n}
              bottomOverlay={withBottomOverlay}
              curveBottomRight={curveBottomRight}
              playIconOverlay={isVideoAttachment(attachments[4])}
              height={99}
              width={99}
              darkOverlay={moreMessagesOverlay}
              overlayText={moreMessagesOverlayText}
              attachment={attachments[4]}
              url={getThumbnailUrl(attachments[4])}
              onClick={onClickAttachment}
              onError={onError}
            />
          </div>
        </div>
      </div>
    );
  }
}
