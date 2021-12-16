// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util';

import { Spinner } from '../Spinner';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';

export const InstallScreenLinkInProgressStep = ({
  i18n,
}: Readonly<{ i18n: LocalizerType }>): ReactElement => (
  <div className="module-InstallScreenLinkInProgressStep">
    <TitlebarDragArea />

    <InstallScreenSignalLogo />

    <Spinner size="50px" svgSize="normal" />
    <h1>{i18n('initialSync')}</h1>
    <h2>{i18n('initialSync__subtitle')}</h2>
  </div>
);
