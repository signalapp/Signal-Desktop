import styled from 'styled-components';

import { TypingAnimation } from './TypingAnimation';
import { ConversationTypeEnum } from '../../models/types';

interface TypingBubbleProps {
  conversationType: ConversationTypeEnum;
  isTyping: boolean;
}

const TypingBubbleContainer = styled.div<Pick<TypingBubbleProps, 'isTyping'>>`
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
  const isPrivate = props.conversationType === ConversationTypeEnum.PRIVATE;
  if (!isPrivate || !props.isTyping) {
    return null;
  }

  return (
    <TypingBubbleContainer isTyping={props.isTyping}>
      <TypingAnimation />
    </TypingBubbleContainer>
  );
};
