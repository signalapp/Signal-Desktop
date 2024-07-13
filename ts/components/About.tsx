// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

export type PropsType = {
  closeAbout: () => unknown;
  environment: string;
  i18n: LocalizerType;
  version: string;
};

export function About({
  closeAbout,
  environment,
  i18n,
  version,
}: PropsType): JSX.Element {
  useEscapeHandling(closeAbout);

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
            href="https://github.com/signalapp/Signal-Desktop/blob/main/ACKNOWLEDGMENTS.md"
          >
            {i18n('icu:softwareAcknowledgments')}
          </a>
        </div>
        <div>
          <a className="privacy" href="https://signal.org/legal">
            {i18n('icu:privacyPolicy')}
          </a>
        </div>
      </div>
    </div>
  );
}
