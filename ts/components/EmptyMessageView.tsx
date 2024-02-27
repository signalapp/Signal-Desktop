import { useState } from 'react';
import { useMount } from 'react-use';
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

const StyledPartyPopper = styled.img`
  height: 180px;
  margin: 0 auto;
  -webkit-user-drag: none;
`;

const StyledHeading = styled.p`
  padding: 0;
  margin: 0;
  font-size: var(--font-size-h1);
  font-weight: 700;
`;

const StyledSessionWelcome = styled.p`
  padding: 0;
  margin: 0;
  color: var(--primary-color);
  font-size: var(--font-size-h2);
`;

export const EmptyMessageView = () => {
  const [newAccountCreated, setNewAccountCreated] = useState(false);

  useMount(() => {
    const launchCount = window.getSettingValue('launch-count');
    window.log.debug(`WIP: [launch-count] ${launchCount}`);

    if (!launchCount || launchCount < 1) {
      setNewAccountCreated(true);
    }
  });

  if (newAccountCreated) {
    return (
      <StyledPlaceholder
        container={true}
        className="content"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        margin="auto"
      >
        <StyledPartyPopper src="images/party-popper.svg" alt="party popper emoji" />
        <StyledHeading>{window.i18n('onboardingAccountCreated')}</StyledHeading>
        <StyledSessionWelcome>
          {window.i18n('onboardingBubbleWelcomeToSession')}
        </StyledSessionWelcome>
      </StyledPlaceholder>
    );
  }

  return (
    <StyledPlaceholder
      container={true}
      className="content"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      margin="auto"
    >
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
