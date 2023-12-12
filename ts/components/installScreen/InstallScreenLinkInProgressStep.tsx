// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util';

import { Spinner } from '../Spinner';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';

export type Props = Readonly<{ i18n: LocalizerType }>;

export function InstallScreenLinkInProgressStep({ i18n }: Props): ReactElement {
  return (
    <div className="module-InstallScreenLinkInProgressStep">
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      <Spinner size="50px" svgSize="normal" />
      <h1 role="status">{i18n('icu:initialSync')}</h1>
      <h2 role="status">{i18n('icu:initialSync__subtitle')}</h2>
    </div>
  );
}
