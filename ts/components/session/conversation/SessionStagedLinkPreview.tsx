import React from 'react';
import { arrayBufferFromFile } from '../../../types/Attachment';
import { AttachmentUtil, LinkPreviewUtil } from '../../../util';
import { StagedLinkPreviewData } from './SessionCompositionBox';
import { default as insecureNodeFetch } from 'node-fetch';
import { fetchLinkPreviewImage } from '../../../util/linkPreviewFetch';
import { AbortSignal } from 'abort-controller';
import { StagedLinkPreview } from '../../conversation/StagedLinkPreview';

export interface StagedLinkPreviewProps extends StagedLinkPreviewData {
  onClose: (url: string) => void;
}
export const LINK_PREVIEW_TIMEOUT = 60 * 1000;

export interface GetLinkPreviewResultImage {
  data: ArrayBuffer;
  size: number;
  contentType: string;
  width: number;
  height: number;
}

export interface GetLinkPreviewResult {
  title: string;
  url: string;
  image?: GetLinkPreviewResultImage;
  description: string | null;
  date: number | null;
}

export const getPreview = async (
  url: string,
  abortSignal: AbortSignal
): Promise<null | GetLinkPreviewResult> => {
  // This is already checked elsewhere, but we want to be extra-careful.
  if (!window.Signal.LinkPreviews.isLinkSafeToPreview(url)) {
    throw new Error('Link not safe for preview');
  }

  window.log.info('insecureNodeFetch => plaintext for getPreview()');

  const linkPreviewMetadata = await LinkPreviewUtil.fetchLinkPreviewMetadata(
    insecureNodeFetch,
    url,
    abortSignal
  );
  if (!linkPreviewMetadata) {
    throw new Error('Could not fetch link preview metadata');
  }
  const { title, imageHref, description, date } = linkPreviewMetadata;

  let image;
  if (imageHref && window.Signal.LinkPreviews.isLinkSafeToPreview(imageHref)) {
    let objectUrl: void | string;
    try {
      window.log.info('insecureNodeFetch => plaintext for getPreview()');

      const fullSizeImage = await fetchLinkPreviewImage(
        insecureNodeFetch,
        imageHref,
        abortSignal
      );
      if (!fullSizeImage) {
        throw new Error('Failed to fetch link preview image');
      }

      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for attachments
      const withBlob = await AttachmentUtil.autoScale(
        {
          contentType: fullSizeImage.contentType,
          file: new Blob([fullSizeImage.data], {
            type: fullSizeImage.contentType,
          }),
        },
        { maxSize: 100 * 1000 } // this is a preview image. No need for it to be crazy big. 100k is big enough
      );

      const data = await arrayBufferFromFile(withBlob.file);
      objectUrl = URL.createObjectURL(withBlob.file);

      const dimensions = await window.Signal.Types.VisualAttachment.getImageDimensions(
        {
          objectUrl,
          logger: window.log,
        }
      );

      image = {
        data,
        size: data.byteLength,
        ...dimensions,
        contentType: withBlob.file.type,
      };
    } catch (error) {
      // We still want to show the preview if we failed to get an image
      window.log.error(
        'getPreview failed to get image for link preview:',
        error.message
      );
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  return {
    title,
    url,
    image,
    description,
    date,
  };
};

export const SessionStagedLinkPreview = (props: StagedLinkPreviewProps) => {
  if (!props.url) {
    return <></>;
  }

  return (
    <StagedLinkPreview
      onClose={props.onClose}
      isLoaded={props.isLoaded}
      title={props.title}
      domain={props.domain}
      url={props.url}
      image={props.image as any}
      description={props.description}
    />
  );
};
