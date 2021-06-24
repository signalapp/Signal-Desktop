// tslint:disable:react-this-binding-issue

import React, { useState } from 'react';
import classNames from 'classnames';

import * as MIME from '../../../ts/types/MIME';
import * as GoogleChrome from '../../../ts/util/GoogleChrome';

import { MessageBody } from './MessageBody';
import { ContactName } from './ContactName';
import { PubKey } from '../../session/types';
import { ConversationTypeEnum } from '../../models/conversation';

import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';

interface QuoteProps {
  attachment?: QuotedAttachmentType;
  authorPhoneNumber: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  conversationType: ConversationTypeEnum;
  convoId: string;
  isPublic?: boolean;
  withContentAbove: boolean;
  onClick?: (e: any) => void;
  text: string;
  referencedMessageNotFound: boolean;
}

export interface QuotedAttachmentType {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: Attachment;
}

interface Attachment {
  contentType: MIME.MIMEType;
  /** Not included in protobuf, and is loaded asynchronously */
  objectUrl?: string;
}

function validateQuote(quote: QuoteProps): boolean {
  if (quote.text) {
    return true;
  }

  if (quote.attachment) {
    return true;
  }

  return false;
}

function getObjectUrl(thumbnail: Attachment | undefined): string | undefined {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return;
}

function getTypeLabel({
  contentType,
  isVoiceMessage,
}: {
  contentType: MIME.MIMEType;
  isVoiceMessage: boolean;
}): string | undefined {
  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return window.i18n('video');
  }
  if (GoogleChrome.isImageTypeSupported(contentType)) {
    return window.i18n('photo');
  }
  if (MIME.isAudio(contentType) && isVoiceMessage) {
    return window.i18n('voiceMessage');
  }
  if (MIME.isAudio(contentType)) {
    return window.i18n('audio');
  }

  return;
}
export const QuoteIcon = (props: any) => {
  const { icon } = props;

  return (
    <div className="module-quote__icon-container">
      <div className="module-quote__icon-container__inner">
        <div className="module-quote__icon-container__circle-background">
          <div
            className={classNames(
              'module-quote__icon-container__icon',
              `module-quote__icon-container__icon--${icon}`
            )}
          />
        </div>
      </div>
    </div>
  );
};

export const QuoteImage = (props: any) => {
  const { url, icon, contentType, handleImageErrorBound } = props;

  const { loading, urlToLoad } = useEncryptedFileFetch(url, contentType);
  const srcData = !loading ? urlToLoad : '';

  const iconElement = icon ? (
    <div className="module-quote__icon-container__inner">
      <div className="module-quote__icon-container__circle-background">
        <div
          className={classNames(
            'module-quote__icon-container__icon',
            `module-quote__icon-container__icon--${icon}`
          )}
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="module-quote__icon-container">
      <img src={srcData} alt={window.i18n('quoteThumbnailAlt')} onError={handleImageErrorBound} />
      {iconElement}
    </div>
  );
};

export const QuoteGenericFile = (props: any) => {
  const { attachment, isIncoming } = props;

  if (!attachment) {
    return <></>;
  }

  const { fileName, contentType } = attachment;
  const isGenericFile =
    !GoogleChrome.isVideoTypeSupported(contentType) &&
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !MIME.isAudio(contentType);

  if (!isGenericFile) {
    return <></>;
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

export const QuoteIconContainer = (props: any) => {
  const { attachment, imageBroken, handleImageErrorBound } = props;

  if (!attachment) {
    return null;
  }

  const { contentType, thumbnail } = attachment;
  const objectUrl = getObjectUrl(thumbnail);

  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return objectUrl && !imageBroken ? (
      <QuoteImage url={objectUrl} icon={'play'} />
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

export const QuoteText = (props: any) => {
  const { text, attachment, isIncoming, conversationType, convoId } = props;
  const isGroup = conversationType === ConversationTypeEnum.GROUP;

  if (text) {
    return (
      <div
        dir="auto"
        className={classNames(
          'module-quote__primary__text',
          isIncoming ? 'module-quote__primary__text--incoming' : null
        )}
      >
        <MessageBody isGroup={isGroup} convoId={convoId} text={text} disableLinks={true} />
      </div>
    );
  }

  if (!attachment) {
    return null;
  }

  const { contentType, isVoiceMessage } = attachment;

  const typeLabel = getTypeLabel({ contentType, isVoiceMessage });
  if (typeLabel) {
    return (
      <div
        className={classNames(
          'module-quote__primary__type-label',
          isIncoming ? 'module-quote__primary__type-label--incoming' : null
        )}
      >
        {typeLabel}
      </div>
    );
  }

  return null;
};

export const QuoteAuthor = (props: any) => {
  const {
    authorProfileName,
    authorPhoneNumber,
    authorName,
    isFromMe,
    isIncoming,
    isPublic,
  } = props;

  return (
    <div
      className={classNames(
        'module-quote__primary__author',
        isIncoming ? 'module-quote__primary__author--incoming' : null
      )}
    >
      {isFromMe ? (
        window.i18n('you')
      ) : (
        <ContactName
          phoneNumber={PubKey.shorten(authorPhoneNumber)}
          name={authorName}
          profileName={authorProfileName}
          compact={true}
          shouldShowPubkey={Boolean(isPublic)}
        />
      )}
    </div>
  );
};

export const QuoteReferenceWarning = (props: any) => {
  const { isIncoming, referencedMessageNotFound } = props;

  if (!referencedMessageNotFound) {
    return null;
  }

  return (
    <div
      className={classNames(
        'module-quote__reference-warning',
        isIncoming ? 'module-quote__reference-warning--incoming' : null
      )}
    >
      <div
        className={classNames(
          'module-quote__reference-warning__icon',
          isIncoming ? 'module-quote__reference-warning__icon--incoming' : null
        )}
      />
      <div
        className={classNames(
          'module-quote__reference-warning__text',
          isIncoming ? 'module-quote__reference-warning__text--incoming' : null
        )}
      >
        {window.i18n('originalMessageNotFound')}
      </div>
    </div>
  );
};

export const Quote = (props: QuoteProps) => {
  const [imageBroken, setImageBroken] = useState(false);

  const handleImageErrorBound = null;

  const handleImageError = () => {
    // tslint:disable-next-line no-console
    console.log('Message: Image failed to load; failing over to placeholder');
    setImageBroken(true);
  };

  const { isIncoming, onClick, referencedMessageNotFound, withContentAbove } = props;

  if (!validateQuote(props)) {
    return null;
  }

  return (
    <>
      <div
        className={classNames(
          'module-quote-container',
          withContentAbove ? 'module-quote-container--with-content-above' : null
        )}
      >
        <div
          onClick={onClick}
          role="button"
          className={classNames(
            'module-quote',
            isIncoming ? 'module-quote--incoming' : 'module-quote--outgoing',
            !onClick ? 'module-quote--no-click' : null,
            withContentAbove ? 'module-quote--with-content-above' : null,
            referencedMessageNotFound ? 'module-quote--with-reference-warning' : null
          )}
        >
          <div className="module-quote__primary">
            <QuoteAuthor {...props} />
            <QuoteGenericFile {...props} />
            <QuoteText {...props} />
          </div>
          <QuoteIconContainer {...props} handleImageErrorBound={handleImageErrorBound} />
        </div>
        <QuoteReferenceWarning {...props} />
      </div>
    </>
  );
};
