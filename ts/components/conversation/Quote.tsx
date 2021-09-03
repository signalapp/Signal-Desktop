// tslint:disable:react-this-binding-issue

import React, { useCallback, useState } from 'react';
import classNames from 'classnames';

import * as MIME from '../../../ts/types/MIME';
import * as GoogleChrome from '../../../ts/util/GoogleChrome';

import { MessageBody } from './MessageBody';
import { ContactName } from './ContactName';
import { PubKey } from '../../session/types';

import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { useSelector } from 'react-redux';
import {
  getSelectedConversationKey,
  isGroupConversation,
  isPublicGroupConversation,
} from '../../state/selectors/conversations';
import { noop } from 'underscore';

export type QuotePropsWithoutListener = {
  attachment?: QuotedAttachmentType;
  authorPhoneNumber: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  text: string | null;
  referencedMessageNotFound: boolean;
};

export type QuotePropsWithListener = QuotePropsWithoutListener & {
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

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

function validateQuote(quote: QuotePropsWithoutListener): boolean {
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

export const QuoteImage = (props: {
  handleImageErrorBound: () => void;
  url: string;
  contentType: string;
  icon?: string;
}) => {
  const { url, icon, contentType, handleImageErrorBound } = props;

  const { loading, urlToLoad } = useEncryptedFileFetch(url, contentType);
  const srcData = !loading ? urlToLoad : '';

  const onDragStart = useCallback((e: any) => {
    e.preventDefault();
    return false;
  }, []);

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
      <img
        src={srcData}
        alt={window.i18n('quoteThumbnailAlt')}
        onDragStart={onDragStart}
        onError={handleImageErrorBound}
      />
      {iconElement}
    </div>
  );
};

export const QuoteGenericFile = (
  props: Pick<QuotePropsWithoutListener, 'attachment' | 'isIncoming'>
) => {
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

export const QuoteText = (
  props: Pick<QuotePropsWithoutListener, 'text' | 'attachment' | 'isIncoming'>
) => {
  const { text, attachment, isIncoming } = props;
  const isGroup = useSelector(isGroupConversation);
  const convoId = useSelector(getSelectedConversationKey);

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

type QuoteAuthorProps = {
  authorPhoneNumber: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  showPubkeyForAuthor?: boolean;
};

const QuoteAuthor = (props: QuoteAuthorProps) => {
  const { authorProfileName, authorPhoneNumber, authorName, isFromMe, isIncoming } = props;

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
          shouldShowPubkey={Boolean(props.showPubkeyForAuthor)}
        />
      )}
    </div>
  );
};

export const QuoteReferenceWarning = (
  props: Pick<QuotePropsWithoutListener, 'isIncoming' | 'referencedMessageNotFound'>
) => {
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

export const Quote = (props: QuotePropsWithListener) => {
  const [imageBroken, setImageBroken] = useState(false);
  const handleImageErrorBound = () => {
    setImageBroken(true);
  };

  const isPublic = useSelector(isPublicGroupConversation);

  if (!validateQuote(props)) {
    return null;
  }

  const { isIncoming, referencedMessageNotFound, attachment, text, onClick } = props;

  return (
    <div className={classNames('module-quote-container')}>
      <div
        onClick={onClick}
        role="button"
        className={classNames(
          'module-quote',
          isIncoming ? 'module-quote--incoming' : 'module-quote--outgoing',
          !onClick ? 'module-quote--no-click' : null,
          referencedMessageNotFound ? 'module-quote--with-reference-warning' : null
        )}
      >
        <div className="module-quote__primary">
          <QuoteAuthor
            authorName={props.authorName}
            authorPhoneNumber={props.authorPhoneNumber}
            authorProfileName={props.authorProfileName}
            isFromMe={props.isFromMe}
            isIncoming={props.isIncoming}
            showPubkeyForAuthor={isPublic}
          />
          <QuoteGenericFile {...props} />
          <QuoteText isIncoming={isIncoming} text={text} attachment={attachment} />
        </div>
        <QuoteIconContainer
          attachment={attachment}
          handleImageErrorBound={handleImageErrorBound}
          imageBroken={imageBroken}
        />
      </div>
      <QuoteReferenceWarning
        isIncoming={isIncoming}
        referencedMessageNotFound={referencedMessageNotFound}
      />
    </div>
  );
};
