import React from 'react';
import classNames from 'classnames';
import { MIME } from '../../../../../types';
import { GoogleChrome } from '../../../../../util';
import { QuotePropsWithoutListener } from './Quote';

export const QuoteGenericFile = (
  props: Pick<QuotePropsWithoutListener, 'attachment' | 'isIncoming'>
) => {
  const { attachment, isIncoming } = props;

  if (!attachment) {
    return null;
  }

  const { fileName, contentType } = attachment;
  const isGenericFile =
    !GoogleChrome.isVideoTypeSupported(contentType) &&
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !MIME.isAudio(contentType);

  if (!isGenericFile) {
    return null;
  }

  return (
    <div className="module-quote__generic-file">
      <div className="module-quote__generic-file__icon" />
      <div
        className={classNames(
          'module-quote__generic-file__text',
          isIncoming ? 'module-quote__generic-file__text--incoming' : null
        )}
      >
        {fileName}
      </div>
    </div>
  );
};
