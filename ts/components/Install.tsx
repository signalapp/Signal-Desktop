import React from 'react';
import { BackboneHost } from './BackboneHost';

export const Install = (): JSX.Element => {
  return (
    <BackboneHost
      className="full-screen-flow"
      View={window.Whisper.InstallView}
    />
  );
};
