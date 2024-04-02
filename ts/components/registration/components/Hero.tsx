import styled from 'styled-components';

const StyledHeroContainer = styled.div`
  width: 40%;
  height: 100%;

  div {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
`;

const StyledHero = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
`;

export const Hero = () => {
  return (
    <StyledHeroContainer>
      <div>
        <StyledHero src={'images/hero.png'} />
      </div>
    </StyledHeroContainer>
  );
};
