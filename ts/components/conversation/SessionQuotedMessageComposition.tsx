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
import { getAbsoluteAttachmentPath } from '../../types/MessageAttachment';

const QuotedMessageComposition = styled(Flex)`
  border-top: 1px solid var(--border-color);
`;

const QuotedMessageCompositionReply = styled(Flex)<{ hasAttachments: boolean }>`
  ${props => !props.hasAttachments && 'border-left: 3px solid var(--primary-color);'}
`;

const Subtle = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  display: -webkit-box;
  color: var(--text-primary-color);
`;

const StyledImage = styled.div`
  div {
    border-radius: 4px;
    overflow: hidden;
  }
`;

const StyledText = styled(Flex)`
  margin: 0 0 0 var(--margins-sm);
  p {
    font-weight: bold;
    margin: 0;
  }
`;

export const SessionQuotedMessageComposition = () => {
  const quotedMessageProps = useSelector(getQuotedMessage);

  const dispatch = useDispatch();

  const { author, attachments, text: quoteText } = quotedMessageProps || {};

  const hasAttachments = attachments && attachments.length > 0 && attachments[0];
  const firstImageAttachment =
    hasAttachments && attachments[0].contentType !== AUDIO_MP3 && attachments[0].thumbnail
      ? attachments[0]
      : undefined;
  const hasAudio = hasAttachments && isAudio(attachments);
  const hasAudioAttachment = hasAudio !== false && hasAudio !== undefined && hasAudio !== '';
  const subtitleText =
    hasAttachments && firstImageAttachment
      ? window.i18n('image')
      : hasAudioAttachment
      ? window.i18n('audio')
      : quoteText !== ''
      ? quoteText
      : null;

  const removeQuotedMessage = () => {
    dispatch(quoteMessage(undefined));
  };

  useKey('Escape', removeQuotedMessage, undefined, []);

  if (!author || !quotedMessageProps?.id) {
    return null;
  }

  return (
    <QuotedMessageComposition
      container={true}
      justifyContent="space-between"
      alignItems="center"
      width={'100%'}
      flexGrow={1}
      padding={'var(--margins-md)'}
    >
      <QuotedMessageCompositionReply
        container={true}
        justifyContent="flex-start"
        alignItems={'center'}
        hasAttachments={hasAttachments}
      >
        {hasAttachments && (
          <StyledImage>
            {firstImageAttachment ? (
              <Image
                alt={getAlt(firstImageAttachment)}
                attachment={firstImageAttachment}
                height={100}
                width={100}
                url={getAbsoluteAttachmentPath((firstImageAttachment as any).thumbnail.path)}
                softCorners={true}
              />
            ) : hasAudioAttachment ? (
              <div style={{ margin: '0 var(--margins-xs) 0 0' }}>
                <SessionIcon iconType="microphone" iconSize="huge" />
              </div>
            ) : null}
          </StyledImage>
        )}
        <StyledText
          container={true}
          flexDirection="column"
          justifyContent={'center'}
          alignItems={'flex-start'}
        >
          <p>{author}</p>
          {subtitleText && <Subtle>{subtitleText}</Subtle>}
        </StyledText>
      </QuotedMessageCompositionReply>
      <SessionIconButton
        iconType="exit"
        iconColor="var(--chat-buttons-icon-color)"
        iconSize="small"
        onClick={removeQuotedMessage}
        margin={'0 var(--margins-sm) 0 0'}
        aria-label={window.i18n('close')}
      />
    </QuotedMessageComposition>
  );
};
