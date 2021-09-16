// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  closeAbout: () => unknown;
  environment: string;
  i18n: LocalizerType;
  version: string;
};

export const About = ({
  closeAbout,
  i18n,
  environment,
  version,
}: PropsType): JSX.Element => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAbout();

        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [closeAbout]);

  return (
    <div className="About">
      <div className="module-splash-screen">
        <div className="module-splash-screen__logo module-img--150" />

        <div className="version">{version}</div>
        <div className="environment">{environment}</div>
        <div>
          <a href="https://signal.org">signal.org</a>
        </div>
        <br />
        <div>
          <a
            className="acknowledgments"
            href="https://github.com/signalapp/Signal-Desktop/blob/development/ACKNOWLEDGMENTS.md"
          >
            {i18n('softwareAcknowledgments')}
          </a>
        </div>
        <div>
          <a className="privacy" href="https://signal.org/legal">
            {i18n('privacyPolicy')}
          </a>
        </div>
      </div>
    </div>
  );
};
