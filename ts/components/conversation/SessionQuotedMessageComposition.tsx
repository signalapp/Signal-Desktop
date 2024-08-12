import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { SessionIcon, SessionIconButton } from '../icon';

import { quoteMessage } from '../../state/ducks/conversations';
import { getQuotedMessage } from '../../state/selectors/conversations';
import { getAlt, isAudio } from '../../types/Attachment';
import { AUDIO_MP3 } from '../../types/MIME';
import { Flex } from '../basic/Flex';
import { Image } from './Image';

import { findAndFormatContact } from '../../models/message';
import { getAbsoluteAttachmentPath } from '../../types/MessageAttachment';
import { GoogleChrome } from '../../util';

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

function checkHasAttachments(attachments: Array<any> | undefined) {
  const hasAttachments = attachments && attachments.length > 0 && attachments[0];

  // NOTE could be a video as well which will load a thumbnail
  const firstImageLikeAttachment =
    hasAttachments && attachments[0].contentType !== AUDIO_MP3 && attachments[0].thumbnail
      ? attachments[0]
      : undefined;

  return { hasAttachments, firstImageLikeAttachment };
}

function renderSubtitleText(
  quoteText: string | undefined,
  hasAudioAttachment: boolean,
  isGenericFile: boolean,
  isVideo: boolean,
  isImage: boolean
): string | null {
  return quoteText && quoteText !== ''
    ? quoteText
    : hasAudioAttachment
      ? window.i18n('audio')
      : isGenericFile
        ? window.i18n('document')
        : isVideo
          ? window.i18n('video')
          : isImage
            ? window.i18n('image')
            : null;
}

export const SessionQuotedMessageComposition = () => {
  const dispatch = useDispatch();
  const quotedMessageProps = useSelector(getQuotedMessage);

  const { author, attachments, text: quoteText } = quotedMessageProps || {};

  const removeQuotedMessage = () => {
    dispatch(quoteMessage(undefined));
  };

  useKey('Escape', removeQuotedMessage, undefined, []);

  if (!author || !quotedMessageProps?.id) {
    return null;
  }

  const contact = findAndFormatContact(author);
  const authorName = contact?.profileName || contact?.name || author || window.i18n('unknown');

  const { hasAttachments, firstImageLikeAttachment } = checkHasAttachments(attachments);
  const isImage = Boolean(
    firstImageLikeAttachment &&
      GoogleChrome.isImageTypeSupported(firstImageLikeAttachment.contentType)
  );
  const isVideo = Boolean(
    firstImageLikeAttachment &&
      GoogleChrome.isVideoTypeSupported(firstImageLikeAttachment.contentType)
  );
  const hasAudioAttachment = Boolean(hasAttachments && isAudio(attachments));
  const isGenericFile = !hasAudioAttachment && !isVideo && !isImage;

  const subtitleText = renderSubtitleText(
    quoteText,
    hasAudioAttachment,
    isGenericFile,
    isVideo,
    isImage
  );

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
            {firstImageLikeAttachment ? (
              <Image
                alt={getAlt(firstImageLikeAttachment)}
                attachment={firstImageLikeAttachment}
                height={100}
                width={100}
                url={getAbsoluteAttachmentPath((firstImageLikeAttachment as any).thumbnail.path)}
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
          <p>{authorName}</p>
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
