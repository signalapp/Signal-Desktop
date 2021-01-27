import React from 'react';

import { TypingAnimation } from './TypingAnimation';
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
  padding-inline-start: 4px;
  overflow: hidden;
  flex-shrink: 0;
`;

export const TypingBubble = (props: TypingBubbleProps) => {

  if (props.conversationType === 'group') {
    return <></>;
  }

  return (
    <TypingBubbleContainer {...props}>
      <TypingAnimation i18n={window.i18n} />
    </TypingBubbleContainer>
  );
};
