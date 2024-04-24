import React from 'react';
import styled from 'styled-components';
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

export const AddStagedAttachmentButton = (props: { onClick: () => void }) => {
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

export const StartRecordingButton = (props: { onClick: () => void }) => {
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
export const ToggleEmojiButton = React.forwardRef<HTMLButtonElement, { onClick: () => void }>(
  (props, ref) => {
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
  }
);

export const SendMessageButton = (props: { onClick: () => void }) => {
  return (
    <StyledChatButtonContainer className="send-message-button">
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
