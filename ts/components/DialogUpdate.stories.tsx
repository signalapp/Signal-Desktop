// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogUpdate';
import { DialogUpdate } from './DialogUpdate';
import { DialogType } from '../types/Dialogs';
import { WidthBreakpoint } from './_util';
import { SECOND } from '../util/durations';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  dismissDialog: action('dismiss-dialog'),
  downloadSize: 116504357,
  downloadedSize: 61003110,
  i18n,
  showEventsCount: 0,
  snoozeUpdate: action('snooze-update'),
  startUpdate: action('start-update'),
  version: 'v7.7.7',
};

export default {
  title: 'Components/DialogUpdate',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function KnobsPlayground(): JSX.Element {
  const containerWidthBreakpoint = WidthBreakpoint.Wide;
  const dialogType = DialogType.AutoUpdate;

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={containerWidthBreakpoint}
        dialogType={dialogType}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  );
}

export function UpdateWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        dialogType={DialogType.AutoUpdate}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  );
}

export function DownloadedWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        dialogType={DialogType.DownloadedUpdate}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  );
}

export function DownloadReadyWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.DownloadReady}
        downloadSize={30123456}
      />
    </FakeLeftPaneContainer>
  );
}

export function FullDownloadReadyWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.FullDownloadReady}
        downloadSize={300123456}
      />
    </FakeLeftPaneContainer>
  );
}

export function DownloadingWide(): JSX.Element {
  const [downloadedSize, setDownloadedSize] = React.useState(0);

  const { downloadSize } = defaultProps;

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDownloadedSize(x => {
        const newValue = x + 0.25 * downloadSize;
        if (newValue > downloadSize) {
          return 0;
        }
        return newValue;
      });
    }, SECOND);

    return () => clearInterval(interval);
  }, [downloadSize]);

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        downloadedSize={downloadedSize}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.Downloading}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.Cannot_Update}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateBetaWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0-beta.1"
        dialogType={DialogType.Cannot_Update}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateRequireManualWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.Cannot_Update_Require_Manual}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateRequireManualBetaWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0-beta.1"
        dialogType={DialogType.Cannot_Update_Require_Manual}
      />
    </FakeLeftPaneContainer>
  );
}

export function MacOSReadOnlyWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.MacOS_Read_Only}
      />
    </FakeLeftPaneContainer>
  );
}

export function UnsupportedOSWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        currentVersion="5.24.0"
        dialogType={DialogType.UnsupportedOS}
      />
    </FakeLeftPaneContainer>
  );
}

export function UpdateNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        dialogType={DialogType.AutoUpdate}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  );
}

export function DownloadedNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        dialogType={DialogType.DownloadedUpdate}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  );
}

export function DownloadReadyNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.DownloadReady}
        downloadSize={30123456}
      />
    </FakeLeftPaneContainer>
  );
}

export function FullDownloadReadyNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.FullDownloadReady}
        downloadSize={300123456}
      />
    </FakeLeftPaneContainer>
  );
}

export function DownloadingNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.Downloading}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.Cannot_Update}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateBetaNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0-beta.1"
        dialogType={DialogType.Cannot_Update}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateRequireManualNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.Cannot_Update_Require_Manual}
      />
    </FakeLeftPaneContainer>
  );
}

export function CannotUpdateRequireManualBetaNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0-beta.1"
        dialogType={DialogType.Cannot_Update_Require_Manual}
      />
    </FakeLeftPaneContainer>
  );
}

export function MacOSReadOnlyNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.MacOS_Read_Only}
      />
    </FakeLeftPaneContainer>
  );
}

export function UnsupportedOSNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        currentVersion="5.24.0"
        dialogType={DialogType.UnsupportedOS}
      />
    </FakeLeftPaneContainer>
  );
}
