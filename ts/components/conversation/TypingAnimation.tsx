import React from 'react';
import styled from 'styled-components';

const StyledTypingContainer = styled.div`
  display: inline-flex;
  flex-direction: row;
  align-items: center;

  height: 8px;
  width: 38px;
  padding-inline-start: 1px;
  padding-inline-end: 1px;
`;

const StyledTypingDot = styled.div<{ index: number }>`
  border-radius: 50%;
  background-color: var(--text-secondary-color);

  height: 6px;
  width: 6px;
  opacity: 0.4;

  @keyframes typing-animation-first {
    0% {
      opacity: 0.4;
    }
    20% {
      transform: scale(1.3);
      opacity: 1;
    }
    40% {
      opacity: 0.4;
    }
  }

  @keyframes typing-animation-second {
    10% {
      opacity: 0.4;
    }
    30% {
      transform: scale(1.3);
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  @keyframes typing-animation-third {
    20% {
      opacity: 0.4;
    }
    40% {
      transform: scale(1.3);
      opacity: 1;
    }
    60% {
      opacity: 0.4;
    }
  }

  animation: ${props =>
      props.index === 0
        ? 'typing-animation-first'
        : props.index === 1
          ? 'typing-animation-second'
          : 'typing-animation-third'}
    1600ms ease infinite;
`;

const StyledSpacer = styled.div`
  flex-grow: 1;
`;

export const TypingAnimation = () => {
  return (
    <StyledTypingContainer title={window.i18n('typingAlt')} aria-label={window.i18n('typingAlt')}>
      <StyledTypingDot index={0} />
      <StyledSpacer />
      <StyledTypingDot index={1} />

      <StyledSpacer />
      <StyledTypingDot index={2} />
    </StyledTypingContainer>
  );
};
