// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo } from 'react';
import { useSelector } from 'react-redux';

import { getIntl, getTheme } from '../selectors/user.std.ts';
import { EntryPoint } from '../../components/EntryPoint.dom.tsx';
import { useAppActions } from '../ducks/app.preload.ts';
import { useInstallerActions } from '../ducks/installer.preload.ts';

export const SmartEntryPoint = memo(function SmartEntryPoint() {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const { openStandalone: startStandaloneRegistration } = useAppActions();
  const { startInstaller: startLinkProcess } = useInstallerActions();

  return (
    <EntryPoint
      i18n={i18n}
      startLinkProcess={startLinkProcess}
      startStandaloneRegistration={startStandaloneRegistration}
      theme={theme}
    />
  );
});
