import React from 'react';
import { SessionIcon, SessionIconButton } from '../icon';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { quoteMessage } from '../../state/ducks/conversations';
import { getQuotedMessage } from '../../state/selectors/conversations';
import { getAlt, isAudio } from '../../types/Attachment';
import { AUDIO_MP3 } from '../../types/MIME';
import { Flex } from '../basic/Flex';
import { Image } from '../../../ts/components/conversation/Image';
// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';

const QuotedMessageComposition = styled.div`
  background-color: var(--background-secondary-color);
  width: 100%;
  padding-inline-end: var(--margins-md);
  padding-inline-start: var(--margins-md);
  padding-bottom: var(--margins-xs);
`;

const QuotedMessageCompositionReply = styled.div`
  background: var(--message-bubbles-received-background-color);
  border-radius: var(--margins-sm);
  padding: var(--margins-xs);
  margin: var(--margins-xs);
`;

const Subtle = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  display: -webkit-box;
  color: var(--text-primary-color);
`;

const ReplyingTo = styled.div`
  color: var(--text-primary-color);
`;

export const SessionQuotedMessageComposition = () => {
  const quotedMessageProps = useSelector(getQuotedMessage);

  const dispatch = useDispatch();

  const { text: body, attachments } = quotedMessageProps || {};
  const hasAttachments = attachments && attachments.length > 0;

  let hasImageAttachment = false;

  let firstImageAttachment;
  // we have to handle the case we are trying to reply to an audio message

  if (attachments?.length && attachments[0].contentType !== AUDIO_MP3 && attachments[0].thumbnail) {
    firstImageAttachment = attachments[0];
    hasImageAttachment = true;
  }

  const hasAudioAttachment =
    hasAttachments && attachments && attachments.length > 0 && isAudio(attachments);

  const removeQuotedMessage = () => {
    dispatch(quoteMessage(undefined));
  };

  useKey('Escape', removeQuotedMessage, undefined, []);

  if (!quotedMessageProps?.id) {
    return null;
  }

  return (
    <QuotedMessageComposition>
      <Flex
        container={true}
        justifyContent="space-between"
        flexGrow={1}
        margin={'0 var(--margins-xs) var(--margins-xs)'}
        padding={'var(--margins-xs)'}
      >
        <ReplyingTo>{window.i18n('replyingToMessage')}</ReplyingTo>
        <SessionIconButton iconType="exit" iconSize="small" onClick={removeQuotedMessage} />
      </Flex>
      <QuotedMessageCompositionReply>
        <Flex container={true} justifyContent="space-between" margin={'var(--margins-xs)'}>
          <Subtle>{(hasAttachments && window.i18n('mediaMessage')) || body}</Subtle>

          {hasImageAttachment && (
            <Image
              alt={getAlt(firstImageAttachment)}
              attachment={firstImageAttachment}
              height={100}
              width={100}
              url={firstImageAttachment.thumbnail.objectUrl}
              softCorners={false}
            />
          )}

          {hasAudioAttachment && <SessionIcon iconType="microphone" iconSize="huge" />}
        </Flex>
      </QuotedMessageCompositionReply>
    </QuotedMessageComposition>
  );
};
