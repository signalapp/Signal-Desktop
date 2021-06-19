import React from 'react';
import { BackboneHost } from './BackboneHost';

export const StandaloneRegistration = (): JSX.Element => {
  return (
    <BackboneHost
      className="full-screen-flow"
      View={window.Whisper.StandaloneRegistrationView}
    />
  );
};
