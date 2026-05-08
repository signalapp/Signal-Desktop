// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import {
  CannotUpdateMacOsReadOnlyModal,
  UpdateDownloadingModal,
  UnsupportedOSModal,
  UpdateRequiredModal,
  CannotUpdateModal,
  UpdateAvailableModal,
  UpdateDownloadedModal,
} from './InstallScreenUpdateDialog.dom.tsx';
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/InstallScreen/InstallScreenUpdateDialog',
} satisfies Meta;

export function UpdateRequired(): ReactNode {
  return (
    <UpdateRequiredModal
      i18n={i18n}
      onClose={action('onClose')}
      onForceUpdate={action('onForceUpdate')}
    />
  );
}

export function UpdateAvailableNotReady(): ReactNode {
  return (
    <UpdateAvailableModal
      i18n={i18n}
      onClose={action('onClose')}
      onStartUpdate={action('onStartUpdate')}
      downloadReady={false}
    />
  );
}

export function UpdateAvailableAndReady(): ReactNode {
  return (
    <UpdateAvailableModal
      i18n={i18n}
      onClose={action('onClose')}
      onStartUpdate={action('onStartUpdate')}
      downloadSize={100}
      downloadReady
    />
  );
}

export function UpdateDownloading(): ReactNode {
  return <UpdateDownloadingModal i18n={i18n} progress={25} />;
}

export function UpdateDownloaded(): ReactNode {
  return (
    <UpdateDownloadedModal
      i18n={i18n}
      onClose={action('onClose')}
      onStartUpdate={action('onStartUpdate')}
    />
  );
}

export function UnsupportedOS(): ReactNode {
  return (
    <UnsupportedOSModal i18n={i18n} onClose={action('onClose')} OS="macOS" />
  );
}

export function CannotUpdate(): ReactNode {
  return (
    <CannotUpdateModal
      i18n={i18n}
      onClose={action('onClose')}
      currentVersion="0.0.0"
      needsManualUpdate
      onStartUpdate={action('onStartUpdate')}
    />
  );
}

export function CannotUpdateMacOsReadOnly(): ReactNode {
  return (
    <CannotUpdateMacOsReadOnlyModal i18n={i18n} onClose={action('onClose')} />
  );
}
