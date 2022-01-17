import React from 'react';
import { SessionIconButton } from '../../icon';

export const AddStagedAttachmentButton = (props: { onClick: () => void }) => {
  return (
    <SessionIconButton
      iconType="plusThin"
      backgroundColor={'var(--color-compose-view-button-background)'}
      iconSize={'huge2'}
      borderRadius="300px"
      iconPadding="8px"
      onClick={props.onClick}
    />
  );
};

export const StartRecordingButton = (props: { onClick: () => void }) => {
  return (
    <SessionIconButton
      iconType="microphone"
      iconSize={'huge2'}
      backgroundColor={'var(--color-compose-view-button-background)'}
      borderRadius="300px"
      iconPadding="6px"
      onClick={props.onClick}
    />
  );
};

export const ToggleEmojiButton = React.forwardRef<HTMLDivElement, { onClick: () => void }>(
  (props, ref) => {
    return (
      <SessionIconButton
        iconType="emoji"
        ref={ref}
        backgroundColor="var(--color-compose-view-button-background)"
        iconSize={'huge2'}
        borderRadius="300px"
        iconPadding="6px"
        onClick={props.onClick}
      />
    );
  }
);

export const SendMessageButton = (props: { onClick: () => void }) => {
  return (
    <div className="send-message-button">
      <SessionIconButton
        iconType="send"
        backgroundColor={'var(--color-compose-view-button-background)'}
        iconSize={'huge2'}
        iconRotation={90}
        borderRadius="300px"
        iconPadding="6px"
        onClick={props.onClick}
        dataTestId="send-message-button"
      />
    </div>
  );
};
