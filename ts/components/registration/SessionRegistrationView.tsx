import { useEffect } from 'react';
import { AccentText } from './AccentText';

import { SessionTheme } from '../../themes/SessionTheme';
import { setSignInByLinking } from '../../util/storage';
import { SessionToastContainer } from '../SessionToastContainer';
import { Flex } from '../basic/Flex';
import { SessionIcon } from '../icon';
import { RegistrationStages } from './RegistrationStages';

export const SessionRegistrationView = () => {
  useEffect(() => {
    void setSignInByLinking(false);
  }, []);
  return (
    <SessionTheme>
      <div className="session-fullscreen">
        <div className="session-full-screen-flow session-fullscreen">
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
        </div>
      </div>
    </SessionTheme>
  );
};
