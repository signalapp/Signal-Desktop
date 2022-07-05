// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import { useTheme } from '../hooks/useTheme';
import { TitleBarContainer } from './TitleBarContainer';
import type { ExecuteMenuRoleType } from './TitleBarContainer';

export type PropsType = {
  closeAbout: () => unknown;
  environment: string;
  i18n: LocalizerType;
  version: string;
  hasCustomTitleBar: boolean;
  executeMenuRole: ExecuteMenuRoleType;
};

export const About = ({
  closeAbout,
  i18n,
  environment,
  version,
  hasCustomTitleBar,
  executeMenuRole,
}: PropsType): JSX.Element => {
  useEscapeHandling(closeAbout);

  const theme = useTheme();

  return (
    <TitleBarContainer
      hasCustomTitleBar={hasCustomTitleBar}
      theme={theme}
      executeMenuRole={executeMenuRole}
    >
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
    </TitleBarContainer>
  );
};
