import styled from 'styled-components';

type Props = {
  loading: boolean;
  height?: string;
  width?: string;
};

const StyledSessionSpinner = styled.div<Props>`
  display: inline-block;
  position: relative;
  min-width: 13px;
  min-height: 13px;
  width: ${props => (props.width ? props.width : '80px')};
  height: ${props => (props.height ? props.height : '80px')};
  flex-shrink: 0;

  div {
    position: absolute;
    top: calc(50% - 6.5px);
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--primary-color);
    animation-timing-function: cubic-bezier(0, 1, 1, 0);
  }
  div:nth-child(1) {
    left: 8px;
    animation: session-loader1 var(--duration-session-spinner) infinite;
  }
  div:nth-child(2) {
    left: 8px;
    animation: session-loader2 var(--duration-session-spinner) infinite;
  }
  div:nth-child(3) {
    left: 32px;
    animation: session-loader2 var(--duration-session-spinner) infinite;
  }
  div:nth-child(4) {
    left: 56px;
    animation: session-loader3 var(--duration-session-spinner) infinite;
  }
  @keyframes session-loader1 {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes session-loader3 {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(0);
    }
  }
  @keyframes session-loader2 {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(24px, 0);
    }
  }
`;

export const SessionSpinner = (props: Props) => {
  const { loading, height, width } = props;

  return loading ? (
    <StyledSessionSpinner
      loading={loading}
      height={height}
      width={width}
      data-testid="loading-spinner"
    >
      <div />
      <div />
      <div />
      <div />
    </StyledSessionSpinner>
  ) : null;
};
