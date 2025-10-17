// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util.std.js';

import { Spinner } from '../Spinner.dom.js';
import { TitlebarDragArea } from '../TitlebarDragArea.dom.js';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo.dom.js';

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
