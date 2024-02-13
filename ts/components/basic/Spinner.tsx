import styled from 'styled-components';

type Props = {
  size: 'small' | 'normal';
  direction?: string;
  dataTestId?: string;
};

// Module: Spinner

const spinner56Path =
  'M52.3599009,14.184516 C54.6768062,18.2609741 56,22.9759628 56,28 C56,43.463973 43.463973,56 28,56 L28,54 C42.3594035,54 54,42.3594035 54,28 C54,23.3403176 52.7742128,18.9669331 50.6275064,15.1847144 L52.3599009,14.184516 Z';

const spinner24Path =
  'M22.5600116,6.29547931 C23.4784938,7.99216184 24,9.93517878 24,12 C24,18.627417 18.627417,24 12,24 L12,22 C17.5228475,22 22,17.5228475 22,12 C22,10.2995217 21.5755584,8.6981771 20.8268371,7.29612807 L22.5600116,6.29547931 Z';

const SpinnerArc = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  background: none;
  z-index: 3;
  height: 56px;
  width: 56px;

  animation: spinner-arc-animation 3000ms linear infinite;
  animation-play-state: inherit;

  @keyframes spinner-arc-animation {
    0% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(180deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const SpinnerContainer = styled.div`
  margin-inline-start: auto;
  margin-inline-end: auto;
  position: relative;
  height: 56px;
  width: 56px;

  /* :hover {
    animation-play-state: running;
  }
  animation-play-state: paused;
  */
  animation-play-state: running;
`;

const SpinnerContainerSmall = styled(SpinnerContainer)`
  height: 24px;
  width: 24px;
`;

const SpinnerArcSmall = styled(SpinnerArc)`
  height: 24px;
  width: 24px;
`;

export const Spinner = (props: Props) => {
  const { size } = props;

  if (size === 'small') {
    return (
      <SpinnerContainerSmall data-testid="loading-animation">
        <SpinnerArcSmall>
          <path d={spinner24Path} />
        </SpinnerArcSmall>
      </SpinnerContainerSmall>
    );
  }

  return (
    <SpinnerContainer data-testid="loading-animation">
      <SpinnerArc>
        <path d={spinner56Path} />
      </SpinnerArc>
    </SpinnerContainer>
  );
};
