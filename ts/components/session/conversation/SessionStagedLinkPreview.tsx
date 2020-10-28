import React, { useEffect, useState } from 'react';
import { arrayBufferFromFile, AttachmentType } from '../../../types/Attachment';
import { AttachmentUtil, LinkPreviewUtil } from '../../../util';
import { StagedLinkPreview } from '../../conversation/StagedLinkPreview';
import fetch from 'node-fetch';
import { fetchLinkPreviewImage } from '../../../util/linkPreviewFetch';
import { AbortController, AbortSignal } from 'abort-controller';

type Props = {
  url: string;
  onClose: () => void;
};
const LINK_PREVIEW_TIMEOUT = 60 * 1000;

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

const getPreview = async (
  url: string,
  abortSignal: AbortSignal
): Promise<null | GetLinkPreviewResult> => {
  // This is already checked elsewhere, but we want to be extra-careful.
  if (!window.Signal.LinkPreviews.isLinkSafeToPreview(url)) {
    return null;
  }

  const linkPreviewMetadata = await LinkPreviewUtil.fetchLinkPreviewMetadata(
    fetch,
    url,
    abortSignal
  );
  if (!linkPreviewMetadata) {
    return null;
  }
  const { title, imageHref, description, date } = linkPreviewMetadata;

  let image;
  if (imageHref && window.Signal.LinkPreviews.isLinkSafeToPreview(imageHref)) {
    let objectUrl: void | string;
    try {
      const fullSizeImage = await fetchLinkPreviewImage(
        fetch,
        imageHref,
        abortSignal
      );
      if (!fullSizeImage) {
        throw new Error('Failed to fetch link preview image');
      }

      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for attachments
      const withBlob = await AttachmentUtil.autoScale({
        contentType: fullSizeImage.contentType,
        file: new Blob([fullSizeImage.data], {
          type: fullSizeImage.contentType,
        }),
      });

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

export const SessionStagedLinkPreview = (props: Props) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [image, setImage] = useState<AttachmentType | undefined>(undefined);

  useEffect(() => {
    // Use this abortcontroller to stop current fetch requests when url changed
    const abortController = new AbortController();
    setTimeout(() => {
      abortController.abort();
    }, LINK_PREVIEW_TIMEOUT);

    setIsLoaded(false);
    setTitle(null);
    setDomain(null);
    setDescription(null);
    setImage(undefined);

    getPreview(props.url, abortController.signal)
      .then(ret => {
        setIsLoaded(true);
        if (ret) {
          setTitle(ret.title);
          if (ret.image?.width) {
            if (ret.image) {
              const blob = new Blob([ret.image.data], {
                type: ret.image.contentType,
              });
              const imageAttachment = {
                ...ret.image,
                url: URL.createObjectURL(blob),
                fileName: 'preview',
              };
              setImage(imageAttachment);
            }
          }
          setDomain(window.Signal.LinkPreviews.getDomain(ret.url));
          if (ret.description) {
            setDescription(ret.description);
          }
        }
      })
      .catch(err => {
        abortController.abort();
        setIsLoaded(true);
      });
    return () => {
      // Cancel other in-flight link preview requests.
      abortController.abort();
    };
  }, [props.url]);

  return (
    <StagedLinkPreview
      onClose={props.onClose}
      isLoaded={isLoaded}
      title={title}
      domain={domain}
      image={image as any}
      description={description}
    />
  );
};
