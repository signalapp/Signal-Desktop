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

const QuotedMessageCompositionReply = styled(Flex)`
  border-left: 3px solid var(--primary-color);
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
      >
        {firstImageAttachment && (
          <StyledImage>
            <Image
              alt={getAlt(firstImageAttachment)}
              attachment={firstImageAttachment}
              height={100}
              width={100}
              url={getAbsoluteAttachmentPath((firstImageAttachment as any).thumbnail.path)}
              softCorners={false}
            />
          </StyledImage>
        )}
        <StyledText
          container={true}
          flexDirection="column"
          justifyContent={'center'}
          alignItems={'flex-start'}
        >
          <p>{author}</p>
          <Subtle>
            {(firstImageAttachment && window.i18n('mediaMessage')) ||
              (quoteText !== '' && quoteText)}
          </Subtle>
        </StyledText>

        {hasAudioAttachment && <SessionIcon iconType="microphone" iconSize="huge" />}
      </QuotedMessageCompositionReply>
      <SessionIconButton iconType="exit" iconSize="small" onClick={removeQuotedMessage} />
    </QuotedMessageComposition>
  );
};
