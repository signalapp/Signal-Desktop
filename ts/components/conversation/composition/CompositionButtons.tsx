import { forwardRef } from 'react';
import styled from 'styled-components';
import { Noop } from '../../../types/Util';
import { SessionIconButton } from '../../icon';

const StyledChatButtonContainer = styled.div`
  .session-icon-button {
    svg {
      background-color: var(--chat-buttons-background-color);
    }

    &:hover svg {
      background-color: var(--chat-buttons-background-hover-color);
    }
  }
`;

export const AddStagedAttachmentButton = (props: { onClick: Noop }) => {
  return (
    <StyledChatButtonContainer>
      <SessionIconButton
        iconType="plusThin"
        backgroundColor={'var(--chat-buttons-background-color)'}
        iconColor={'var(--chat-buttons-icon-color)'}
        iconSize={'huge2'}
        borderRadius="300px"
        iconPadding="8px"
        onClick={props.onClick}
        dataTestId="attachments-button"
      />
    </StyledChatButtonContainer>
  );
};

export const StartRecordingButton = (props: { onClick: Noop }) => {
  return (
    <StyledChatButtonContainer>
      <SessionIconButton
        iconType="microphone"
        iconSize={'huge2'}
        backgroundColor={'var(--chat-buttons-background-color)'}
        iconColor={'var(--chat-buttons-icon-color)'}
        borderRadius="300px"
        iconPadding="6px"
        onClick={props.onClick}
        dataTestId="microphone-button"
      />
    </StyledChatButtonContainer>
  );
};

// eslint-disable-next-line react/display-name
export const ToggleEmojiButton = forwardRef<HTMLDivElement, { onClick: Noop }>((props, ref) => {
  return (
    <StyledChatButtonContainer>
      <SessionIconButton
        iconType="emoji"
        ref={ref}
        backgroundColor={'var(--chat-buttons-background-color)'}
        iconColor={'var(--chat-buttons-icon-color)'}
        iconSize={'huge2'}
        borderRadius="300px"
        iconPadding="6px"
        onClick={props.onClick}
        dataTestId="emoji-button"
      />
    </StyledChatButtonContainer>
  );
});

export const SendMessageButton = (props: { onClick: Noop }) => {
  return (
    <StyledChatButtonContainer>
      <SessionIconButton
        iconType="send"
        backgroundColor={'var(--chat-buttons-background-color)'}
        iconColor={'var(--chat-buttons-icon-color)'}
        iconSize={'huge2'}
        iconRotation={90}
        borderRadius="300px"
        iconPadding="6px"
        onClick={props.onClick}
        dataTestId="send-message-button"
      />
    </StyledChatButtonContainer>
  );
};
