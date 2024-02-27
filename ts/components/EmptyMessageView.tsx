import styled from 'styled-components';
import { Flex } from './basic/Flex';

const StyledPlaceholder = styled(Flex)`
  margin: auto;
  height: 100%;
`;

const StyledSessionFullLogo = styled(Flex)`
  img:first-child {
    height: 180px;
    filter: brightness(0) saturate(100%) invert(75%) sepia(84%) saturate(3272%) hue-rotate(103deg)
      brightness(106%) contrast(103%);
    -webkit-user-drag: none;
  }

  img:nth-child(2) {
    margin-top: 10px;
    width: 250px;
    transition: 0s;
    filter: var(--session-logo-text-current-filter);
    -webkit-user-drag: none;
  }
`;

export const EmptyMessageView = () => {
  return (
    <StyledPlaceholder container={true} alignItems="center">
      <StyledSessionFullLogo
        container={true}
        className="content"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        margin="auto"
      >
        <img src="images/session/brand.svg" alt="full-brand-logo" />
        <img src="images/session/session-text.svg" alt="full-brand-text" />
      </StyledSessionFullLogo>
    </StyledPlaceholder>
  );
};
