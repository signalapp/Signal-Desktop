import { useEffect, useState } from 'react';
import { useWindowSize } from 'react-use';
import styled from 'styled-components';

type PositionWithinContainer = 'left' | 'right';

const StyledHeroContainer = styled.div<{ positionWithinContainer: PositionWithinContainer }>`
  position: relative;
  width: 40%;
  height: 100%;
  overflow: hidden;
  z-index: 0;

  // TODO[epic=ses-50] remove this when we have the new mockup with narrower shadows if needed
  &:after {
    content: '';
    position: absolute;
    top: 0;
    right: ${props => (props.positionWithinContainer === 'right' ? '0' : '290px')};
    width: 20px;
    height: 100%;
    background-image: linear-gradient(to right, rgba(27, 27, 27, 0), rgba(27, 27, 27, 1));
  }
`;

const StyledHero = styled.img<{
  scaleFactor: number;
  positionWithinContainer: PositionWithinContainer;
}>`
  width: auto;
  ${props => props.scaleFactor && `height: calc(3701px / ${props.scaleFactor});`}
  position: absolute;
  top: 50%;
  ${props => (props.positionWithinContainer === 'right' ? 'right: 0;' : 'left: 0;')}
  transform: translateY(-50%);
`;

export const Hero = () => {
  const [scaleFactor, setScaleFactor] = useState(2.1); // default width 1024px
  const [positionWithinContainer, setPositionWithinContainer] = useState<PositionWithinContainer>(
    'left'
  );

  const { width } = useWindowSize();

  useEffect(() => {
    if (width) {
      if (width <= 1024) {
        setPositionWithinContainer('right');
        setScaleFactor(2.1);
      } else if (width <= 1920) {
        setPositionWithinContainer('right');
        setScaleFactor(2.0);
      } else if (width <= 2560) {
        setPositionWithinContainer('right');
        setScaleFactor(1.5);
      } else if (width <= 3440) {
        setPositionWithinContainer('left');
        setScaleFactor(1.5);
      } else {
        setPositionWithinContainer('left');
        setScaleFactor(1.5);
      }
    }
  }, [width]);
  return (
    <StyledHeroContainer positionWithinContainer={positionWithinContainer}>
      <StyledHero
        src={'images/hero.png'}
        scaleFactor={scaleFactor}
        positionWithinContainer={positionWithinContainer}
      />
    </StyledHeroContainer>
  );
};
