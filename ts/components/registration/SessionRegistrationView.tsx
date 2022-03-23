import React, { useEffect } from 'react';
import { AccentText } from './AccentText';

import { RegistrationStages } from './RegistrationStages';
import { SessionIcon } from '../icon';
import { SessionToastContainer } from '../SessionToastContainer';
import { SessionTheme } from '../../state/ducks/SessionTheme';
import { Flex } from '../basic/Flex';
import { setSignInByLinking } from '../../util/storage';

export const SessionRegistrationView = () => {
  useEffect(() => {
    setSignInByLinking(false);
  }, []);
  return (
    <SessionTheme>
      <Flex
        className="session-content"
        alignItems="center"
        flexDirection="column"
        container={true}
        height="100%"
      >
        <Flex container={true} margin="auto" alignItems="center" flexDirection="column">
          <SessionToastContainer />
          <SessionIcon iconSize={150} iconType="brand" />

          <AccentText />
          <RegistrationStages />
        </Flex>
      </Flex>
    </SessionTheme>
  );
};
