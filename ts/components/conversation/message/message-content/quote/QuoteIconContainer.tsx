import React from 'react';
import { Attachment, QuotePropsWithoutListener } from './Quote';
import { GoogleChrome } from '../../../../../util';
import { MIME } from '../../../../../types';

import { noop } from 'lodash';
import { QuoteImage } from './QuoteImage';
import { QuoteIcon } from './QuoteIcon';

function getObjectUrl(thumbnail: Attachment | undefined): string | undefined {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return;
}

export const QuoteIconContainer = (
  props: Pick<QuotePropsWithoutListener, 'attachment'> & {
    handleImageErrorBound: () => void;
    imageBroken: boolean;
  }
) => {
  const { attachment, imageBroken, handleImageErrorBound } = props;

  if (!attachment) {
    return null;
  }

  const { contentType, thumbnail } = attachment;
  const objectUrl = getObjectUrl(thumbnail);

  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return objectUrl && !imageBroken ? (
      <QuoteImage
        url={objectUrl}
        contentType={MIME.IMAGE_JPEG}
        icon="play"
        handleImageErrorBound={noop}
      />
    ) : (
      <QuoteIcon icon="movie" />
    );
  }
  if (GoogleChrome.isImageTypeSupported(contentType)) {
    return objectUrl && !imageBroken ? (
      <QuoteImage
        url={objectUrl}
        contentType={contentType}
        handleImageErrorBound={handleImageErrorBound}
      />
    ) : (
      <QuoteIcon icon="image" />
    );
  }
  if (MIME.isAudio(contentType)) {
    return <QuoteIcon icon="microphone" />;
  }
  return null;
};
