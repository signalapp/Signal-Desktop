import React, { useEffect } from 'react';
import { AccentText } from './AccentText';

import { RegistrationStages } from './RegistrationStages';
import { SessionIcon } from '../icon';
import { SessionToastContainer } from '../SessionToastContainer';
import { setSignInByLinking } from '../../session/utils/User';
import { SessionTheme } from '../../state/ducks/SessionTheme';
import { Flex } from '../basic/Flex';
import { SpacerLG } from '../basic/Text';

export const SessionRegistrationView = () => {
  useEffect(() => {
    setSignInByLinking(false);
  }, []);
  return (
    <SessionTheme>
      <Flex
        className="session-content"
        width="100vw"
        height="100vh"
        alignItems="center"
        flexDirection="column"
        container={true}
      >
        <Flex container={true} margin="auto" alignItems="center" flexDirection="column">
          <SessionToastContainer />
          <SpacerLG />
          <SpacerLG />

          <SessionIcon iconSize={150} iconType="brand" />
          <SpacerLG />

          <SpacerLG />
          <SpacerLG />
          <SpacerLG />

          <AccentText />
          <SpacerLG />
          <SpacerLG />
          <SpacerLG />

          <RegistrationStages />
        </Flex>
      </Flex>
    </SessionTheme>
  );
};
