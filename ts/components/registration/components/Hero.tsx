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

  &:after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 100%;
    background-image: linear-gradient(to right, rgba(27, 27, 27, 0), rgba(27, 27, 27, 1));
  }
`;

const StyledHero = styled.img<{
  positionWithinContainer: PositionWithinContainer;
}>`
  width: auto;
  height: 100%;
  position: absolute;
  top: 50%;
  ${props => (props.positionWithinContainer === 'right' ? 'right: -50px;' : 'left: 0;')}
  transform: translateY(-50%);
`;

export const Hero = () => {
  const [positionWithinContainer, setPositionWithinContainer] = useState<PositionWithinContainer>(
    'left'
  );

  const { width } = useWindowSize();

  useEffect(() => {
    if (width) {
      if (width <= 1920) {
        setPositionWithinContainer('right');
      } else {
        setPositionWithinContainer('left');
      }
    }
  }, [width]);

  return (
    <StyledHeroContainer positionWithinContainer={positionWithinContainer}>
      <StyledHero src={'images/hero.png'} positionWithinContainer={positionWithinContainer} />
    </StyledHeroContainer>
  );
};
