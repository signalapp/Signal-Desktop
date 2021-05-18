import React, { useContext } from 'react';
import { Flex } from '../../basic/Flex';
import { SessionIcon, SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { ReplyingToMessageProps } from './SessionCompositionBox';
import styled, { DefaultTheme, ThemeContext } from 'styled-components';
import { getAlt, isAudio, isImageAttachment } from '../../../types/Attachment';
import { Image } from '../../conversation/Image';

// tslint:disable: react-unused-props-and-state
interface Props {
  quotedMessageProps: ReplyingToMessageProps;
  removeQuotedMessage: any;
}

const QuotedMessageComposition = styled.div`
  width: 100%;
  padding-inline-end: ${props => props.theme.common.margins.md};
  padding-inline-start: ${props => props.theme.common.margins.md};
`;

const QuotedMessageCompositionReply = styled.div`
  background: ${props => props.theme.colors.quoteBottomBarBackground};
  border-radius: ${props => props.theme.common.margins.sm};
  padding: ${props => props.theme.common.margins.xs};
  box-shadow: ${props => props.theme.colors.sessionShadow};
  margin: ${props => props.theme.common.margins.xs};
`;

const Subtle = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  display: -webkit-box;
  color: ${props => props.theme.colors.textColor};
`;

const ReplyingTo = styled.div`
  color: ${props => props.theme.colors.textColor};
`;

export const SessionQuotedMessageComposition = (props: Props) => {
  const { quotedMessageProps, removeQuotedMessage } = props;
  const theme = useContext(ThemeContext);

  const { text: body, attachments } = quotedMessageProps;
  const hasAttachments = attachments && attachments.length > 0;

  let hasImageAttachment = false;

  let firstImageAttachment;
  if (attachments && attachments.length > 0) {
    firstImageAttachment = attachments[0];
    hasImageAttachment = true;
  }

  const hasAudioAttachment =
    hasAttachments && attachments && attachments.length > 0 && isAudio(attachments);

  return (
    <QuotedMessageComposition theme={theme}>
      <Flex
        container={true}
        justifyContent="space-between"
        flexGrow={1}
        margin={theme.common.margins.xs}
      >
        <ReplyingTo>{window.i18n('replyingToMessage')}</ReplyingTo>
        <SessionIconButton
          iconType={SessionIconType.Exit}
          iconSize={SessionIconSize.Small}
          onClick={removeQuotedMessage}
          theme={theme}
        />
      </Flex>
      <QuotedMessageCompositionReply>
        <Flex container={true} justifyContent="space-between" margin={theme.common.margins.xs}>
          <Subtle>{(hasAttachments && window.i18n('mediaMessage')) || body}</Subtle>

          {hasImageAttachment && (
            <Image
              alt={getAlt(firstImageAttachment, window.i18n)}
              i18n={window.i18n}
              attachment={firstImageAttachment}
              height={100}
              width={100}
              curveTopLeft={true}
              curveTopRight={true}
              curveBottomLeft={true}
              curveBottomRight={true}
              url={firstImageAttachment.thumbnail.objectUrl}
            />
          )}

          {hasAudioAttachment && (
            <SessionIcon
              iconType={SessionIconType.Microphone}
              iconSize={SessionIconSize.Huge}
              theme={theme}
            />
          )}
        </Flex>
      </QuotedMessageCompositionReply>
    </QuotedMessageComposition>
  );
};
