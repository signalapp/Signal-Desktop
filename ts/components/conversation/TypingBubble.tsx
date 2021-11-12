import React from 'react';

import { TypingAnimation } from './TypingAnimation';
import styled from 'styled-components';
import { ConversationTypeEnum } from '../../models/conversation';

interface TypingBubbleProps {
  avatarPath?: string;
  pubkey: string;
  displayedName: string | null;
  conversationType: ConversationTypeEnum;
  isTyping: boolean;
}

const TypingBubbleContainer = styled.div<TypingBubbleProps>`
  height: ${props => (props.isTyping ? 'auto' : '0px')};
  display: flow-root;
  padding-bottom: ${props => (props.isTyping ? '4px' : '0px')};
  padding-top: ${props => (props.isTyping ? '4px' : '0px')};
  transition: var(--default-duration);
  padding-inline-end: 16px;
  padding-inline-start: 4px;
  overflow: hidden;
  flex-shrink: 0;
`;

export const TypingBubble = (props: TypingBubbleProps) => {
  if (props.conversationType === ConversationTypeEnum.GROUP) {
    return null;
  }

  if (!props.isTyping) {
    return null;
  }

  return (
    <TypingBubbleContainer {...props}>
      <TypingAnimation />
    </TypingBubbleContainer>
  );
};
