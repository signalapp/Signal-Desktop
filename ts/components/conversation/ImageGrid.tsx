import React from 'react';
import classNames from 'classnames';

import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';
import { AttachmentType } from './types';
import { Image } from './Image';
import { Localizer } from '../../types/Util';

interface Props {
  attachments: Array<AttachmentType>;
  withContentAbove: boolean;
  withContentBelow: boolean;
  bottomOverlay?: boolean;

  i18n: Localizer;

  onError: () => void;
  onClickAttachment?: (attachment: AttachmentType) => void;
}

const MAX_WIDTH = 300;
const MAX_HEIGHT = MAX_WIDTH * 1.5;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 25;

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

    if (!attachments || !attachments.length) {
      return null;
    }

    if (attachments.length === 1) {
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
            bottomOverlay={bottomOverlay && curveBottom}
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
            bottomOverlay={bottomOverlay && curveBottom}
            curveTopLeft={curveTopLeft}
            curveBottomLeft={curveBottomLeft}
            playIconOverlay={isVideoAttachment(attachments[0])}
            height={149}
            width={149}
            url={getUrl(attachments[0])}
            onClick={onClickAttachment}
            onError={onError}
          />
          <Image
            alt={getAlt(attachments[1], i18n)}
            i18n={i18n}
            bottomOverlay={bottomOverlay && curveBottom}
            curveTopRight={curveTopRight}
            curveBottomRight={curveBottomRight}
            playIconOverlay={isVideoAttachment(attachments[1])}
            height={149}
            width={149}
            attachment={attachments[1]}
            url={getUrl(attachments[1])}
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
            bottomOverlay={bottomOverlay && curveBottom}
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
              url={getUrl(attachments[1])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[2], i18n)}
              i18n={i18n}
              bottomOverlay={bottomOverlay && curveBottom}
              curveBottomRight={curveBottomRight}
              height={99}
              width={99}
              attachment={attachments[2]}
              playIconOverlay={isVideoAttachment(attachments[2])}
              url={getUrl(attachments[2])}
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
                url={getUrl(attachments[0])}
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
                url={getUrl(attachments[1])}
                onClick={onClickAttachment}
                onError={onError}
              />
            </div>
            <div className="module-image-grid__row">
              <Image
                alt={getAlt(attachments[2], i18n)}
                i18n={i18n}
                bottomOverlay={bottomOverlay && curveBottom}
                curveBottomLeft={curveBottomLeft}
                playIconOverlay={isVideoAttachment(attachments[2])}
                height={149}
                width={149}
                attachment={attachments[2]}
                url={getUrl(attachments[2])}
                onClick={onClickAttachment}
                onError={onError}
              />
              <Image
                alt={getAlt(attachments[3], i18n)}
                i18n={i18n}
                bottomOverlay={bottomOverlay && curveBottom}
                curveBottomRight={curveBottomRight}
                playIconOverlay={isVideoAttachment(attachments[3])}
                height={149}
                width={149}
                attachment={attachments[3]}
                url={getUrl(attachments[3])}
                onClick={onClickAttachment}
                onError={onError}
              />
            </div>
          </div>
        </div>
      );
    }

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
              url={getUrl(attachments[0])}
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
              url={getUrl(attachments[1])}
              onClick={onClickAttachment}
              onError={onError}
            />
          </div>
          <div className="module-image-grid__row">
            <Image
              alt={getAlt(attachments[2], i18n)}
              i18n={i18n}
              bottomOverlay={bottomOverlay && curveBottom}
              curveBottomLeft={curveBottomLeft}
              playIconOverlay={isVideoAttachment(attachments[2])}
              height={99}
              width={99}
              attachment={attachments[2]}
              url={getUrl(attachments[2])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[3], i18n)}
              i18n={i18n}
              bottomOverlay={bottomOverlay && curveBottom}
              playIconOverlay={isVideoAttachment(attachments[3])}
              height={99}
              width={98}
              attachment={attachments[3]}
              url={getUrl(attachments[3])}
              onClick={onClickAttachment}
              onError={onError}
            />
            <Image
              alt={getAlt(attachments[4], i18n)}
              i18n={i18n}
              bottomOverlay={bottomOverlay && curveBottom}
              curveBottomRight={curveBottomRight}
              playIconOverlay={isVideoAttachment(attachments[4])}
              height={99}
              width={99}
              darkOverlay={attachments.length > 5}
              overlayText={
                attachments.length > 5
                  ? `+${attachments.length - 5}`
                  : undefined
              }
              attachment={attachments[4]}
              url={getUrl(attachments[4])}
              onClick={onClickAttachment}
              onError={onError}
            />
          </div>
        </div>
      </div>
    );
  }
}

function getUrl(attachment: AttachmentType) {
  if (attachment.screenshot) {
    return attachment.screenshot.url;
  }

  return attachment.url;
}

export function isImage(attachments?: Array<AttachmentType>) {
  return (
    attachments &&
    attachments[0] &&
    attachments[0].contentType &&
    isImageTypeSupported(attachments[0].contentType)
  );
}

export function hasImage(attachments?: Array<AttachmentType>) {
  return attachments && attachments[0] && attachments[0].url;
}

export function isVideo(attachments?: Array<AttachmentType>) {
  return attachments && isVideoAttachment(attachments[0]);
}

export function isVideoAttachment(attachment?: AttachmentType) {
  return (
    attachment &&
    attachment.contentType &&
    isVideoTypeSupported(attachment.contentType)
  );
}

export function hasVideoScreenshot(attachments?: Array<AttachmentType>) {
  const firstAttachment = attachments ? attachments[0] : null;

  return (
    firstAttachment &&
    firstAttachment.screenshot &&
    firstAttachment.screenshot.url
  );
}

type DimensionsType = {
  height: number;
  width: number;
};

function getImageDimensions(attachment: AttachmentType): DimensionsType {
  const { height, width } = attachment;
  if (!height || !width) {
    return {
      height: MIN_HEIGHT,
      width: MIN_WIDTH,
    };
  }

  const aspectRatio = height / width;
  const targetWidth = Math.max(Math.min(MAX_WIDTH, width), MIN_WIDTH);
  const candidateHeight = Math.round(targetWidth * aspectRatio);

  return {
    width: targetWidth,
    height: Math.max(Math.min(MAX_HEIGHT, candidateHeight), MIN_HEIGHT),
  };
}

export function getGridDimensions(
  attachments?: Array<AttachmentType>
): null | DimensionsType {
  if (!attachments || !attachments.length) {
    return null;
  }

  if (!isImage(attachments) && !isVideo(attachments)) {
    return null;
  }

  if (attachments.length === 1) {
    return getImageDimensions(attachments[0]);
  }

  if (attachments.length === 2) {
    return {
      height: 150,
      width: 300,
    };
  }

  if (attachments.length === 4) {
    return {
      height: 300,
      width: 300,
    };
  }

  return {
    height: 200,
    width: 300,
  };
}

export function getAlt(attachment: AttachmentType, i18n: Localizer): string {
  return isVideoAttachment(attachment)
    ? i18n('videoAttachmentAlt')
    : i18n('imageAttachmentAlt');
}
