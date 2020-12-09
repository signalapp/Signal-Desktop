import React from 'react';
import classNames from 'classnames';

import { TypingAnimation } from './TypingAnimation';
import { Avatar } from '../Avatar';
import styled from 'styled-components';

interface TypingBubbleProps {
  avatarPath?: string;
  phoneNumber: string;
  displayedName: string | null;
  conversationType: string;
  isTyping: boolean;
}

const TypingBubbleContainer = styled.div<TypingBubbleProps>`
  height: ${props => (props.isTyping ? 'auto' : '0px')};
  display: flow-root;
  padding-bottom: ${props => (props.isTyping ? '4px' : '0px')};
  padding-top: ${props => (props.isTyping ? '4px' : '0px')};
  transition: ${props => props.theme.common.animations.defaultDuration};
  padding-inline-end: 16px;
  overflow: hidden;
`;

export const TypingBubble = (props: TypingBubbleProps) => {
  const renderAvatar = () => {
    const { avatarPath, displayedName, conversationType, phoneNumber } = props;

    if (conversationType !== 'group') {
      return;
    }

    return (
      <div className="module-message__author-avatar">
        <Avatar
          avatarPath={avatarPath}
          name={displayedName || phoneNumber}
          size={36}
          pubkey={phoneNumber}
        />
      </div>
    );
  };

  if (props.conversationType === 'group') {
    return <></>;
  }

  return (
    <TypingBubbleContainer {...props}>
      <div className="module-message__typing-container">
        <TypingAnimation i18n={window.i18n} />
      </div>
      {renderAvatar()}
    </TypingBubbleContainer>
  );
};
