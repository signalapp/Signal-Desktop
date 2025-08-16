// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

export type AboutProps = Readonly<{
  closeAbout: () => unknown;
  appEnv: string;
  arch: string;
  platform: string;
  i18n: LocalizerType;
  version: string;
}>;

export function About({
  closeAbout,
  appEnv,
  arch,
  platform,
  i18n,
  version,
}: AboutProps): JSX.Element {
  useEscapeHandling(closeAbout);

  let env: string;

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      env = i18n('icu:About__AppEnvironment--AppleSilicon', { appEnv });
    } else {
      env = i18n('icu:About__AppEnvironment--AppleIntel', { appEnv });
    }
  } else {
    env = i18n('icu:About__AppEnvironment', { appEnv });
  }

  return (
    <div className="About">
      <div className="module-splash-screen">
        <div className="module-splash-screen__logo module-splash-screen__logo--128" />

        <h1 className="About__Title">{i18n('icu:signalDesktop')}</h1>
        <div className="version">{version}</div>
        <div className="environment">{env}</div>
        <br />
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
