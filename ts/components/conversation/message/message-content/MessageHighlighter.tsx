import styled, { css, keyframes } from 'styled-components';

const opacityAnimation = keyframes`
    0% {
      opacity: 1;
    }
    25% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    75% {
      opacity: 0.2;
    }
    100% {
      opacity: 1;
    }
`;

export const MessageHighlighter = styled.div<{
  highlight: boolean;
}>`
  ${props =>
    props.highlight &&
    css`
      animation: ${opacityAnimation} 1s linear;
    `}
`;
