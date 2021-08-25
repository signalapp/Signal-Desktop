// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
