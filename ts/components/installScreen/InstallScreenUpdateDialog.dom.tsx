// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode } from 'react';
import { DialogType } from '../../types/Dialogs.std.ts';
import { InstallScreenStep } from '../../types/InstallScreen.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import {
  PRODUCTION_DOWNLOAD_URL,
  BETA_DOWNLOAD_URL,
  UNSUPPORTED_OS_URL,
} from '../../types/support.std.ts';
import type { UpdatesStateType } from '../../state/ducks/updates.preload.ts';
import { isBeta } from '../../util/version.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { roundFractionForProgressBar } from '../../util/numbers.std.ts';
import { I18n } from '../I18n.dom.tsx';
import { formatFileSize } from '../../util/formatFileSize.std.ts';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

export type PropsType = UpdatesStateType &
  Readonly<{
    i18n: LocalizerType;
    step: InstallScreenStep;
    forceUpdate: () => void;
    startUpdate: () => void;
    currentVersion: string;
    OS: string;
    onClose?: () => void;
  }>;

export function InstallScreenUpdateDialog({
  i18n,
  step,
  dialogType,
  isCheckingForUpdates,
  downloadSize,
  downloadedSize,
  forceUpdate,
  startUpdate,
  currentVersion,
  OS,
  onClose = () => null,
}: PropsType): JSX.Element | null {
  if (dialogType === DialogType.None) {
    if (step === InstallScreenStep.BackupImport) {
      if (isCheckingForUpdates) {
        return <UpdateDownloadingModal i18n={i18n} progress={0} />;
      }

      return (
        <UpdateRequiredModal
          i18n={i18n}
          onClose={onClose}
          onForceUpdate={forceUpdate}
        />
      );
    }

    return null;
  }

  if (dialogType === DialogType.UnsupportedOS) {
    return <UnsupportedOSModal i18n={i18n} onClose={onClose} OS={OS} />;
  }

  if (dialogType === DialogType.DownloadedUpdate) {
    return (
      <UpdateDownloadedModal
        i18n={i18n}
        onClose={onClose}
        onStartUpdate={startUpdate}
      />
    );
  }

  if (
    dialogType === DialogType.AutoUpdate ||
    // Manual update with an action button
    dialogType === DialogType.DownloadReady ||
    dialogType === DialogType.FullDownloadReady
  ) {
    return (
      <UpdateAvailableModal
        i18n={i18n}
        onClose={onClose}
        onStartUpdate={startUpdate}
        downloadSize={downloadSize}
        downloadReady={
          dialogType === DialogType.DownloadReady ||
          dialogType === DialogType.FullDownloadReady
        }
      />
    );
  }

  if (dialogType === DialogType.Downloading) {
    const fractionComplete = roundFractionForProgressBar(
      (downloadedSize || 0) / (downloadSize || 1)
    );
    return (
      <UpdateDownloadingModal i18n={i18n} progress={fractionComplete * 100} />
    );
  }

  if (
    dialogType === DialogType.Cannot_Update ||
    dialogType === DialogType.Cannot_Update_Require_Manual
  ) {
    return (
      <CannotUpdateModal
        i18n={i18n}
        onClose={onClose}
        currentVersion={currentVersion}
        needsManualUpdate={
          dialogType === DialogType.Cannot_Update_Require_Manual
        }
        onStartUpdate={startUpdate}
      />
    );
  }

  if (dialogType === DialogType.MacOS_Read_Only) {
    return <CannotUpdateMacOsReadOnlyModal i18n={i18n} onClose={onClose} />;
  }

  throw missingCaseError(dialogType);
}

/** @testexport */
export function UpdateRequiredModal(props: {
  i18n: LocalizerType;
  onClose: () => void;
  onForceUpdate: () => void;
}): ReactNode {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:InstallScreenUpdateDialog--update-required__title')}
      description={i18n('icu:InstallScreenUpdateDialog--update-required__body')}
    >
      <AxoConfirmDialog.Action variant="primary" onClick={props.onForceUpdate}>
        {i18n('icu:InstallScreenUpdateDialog--update-required__action-update')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

/** @testexport */
export function UpdateAvailableModal(props: {
  i18n: LocalizerType;
  onClose: () => void;
  onStartUpdate: () => void;
  downloadSize?: number;
  downloadReady: boolean;
}): ReactNode {
  const { i18n, onStartUpdate } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:autoUpdateNewVersionTitle')}
      description={i18n('icu:InstallScreenUpdateDialog--auto-update__body')}
    >
      <AxoConfirmDialog.Action
        variant="primary"
        onClick={event => {
          event.preventDefault();
          onStartUpdate();
        }}
      >
        {props.downloadReady ? (
          <I18n
            id="icu:InstallScreenUpdateDialog--manual-update__action"
            i18n={i18n}
            components={{
              downloadSize: (
                <span className={tw('font-regular')}>
                  ({formatFileSize(props.downloadSize ?? 0)})
                </span>
              ),
            }}
          />
        ) : (
          i18n('icu:autoUpdateRestartButtonLabel')
        )}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

/** @testexport */
export function UpdateDownloadingModal(props: {
  i18n: LocalizerType;
  progress: number;
}): ReactNode {
  const { i18n } = props;
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:DialogUpdate__downloading')}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <div className="InstallScreenUpdateDialog__progress--container">
              <div
                className="InstallScreenUpdateDialog__progress--bar"
                style={{ transform: `translateX(${props.progress - 100}%)` }}
              />
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer />
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

/** @testexport */
export function UpdateDownloadedModal(props: {
  i18n: LocalizerType;
  onClose: () => void;
  onStartUpdate: () => void;
}): ReactNode {
  const { i18n, onStartUpdate } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:DialogUpdate__downloaded')}
      description={i18n('icu:InstallScreenUpdateDialog--downloaded__body')}
    >
      <AxoConfirmDialog.Action
        variant="primary"
        onClick={event => {
          event.preventDefault();
          onStartUpdate();
        }}
      >
        {i18n('icu:autoUpdateRestartButtonLabel')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

const learnMoreLink = (parts: Array<string | JSX.Element>) => (
  <a
    key="signal-support"
    href={UNSUPPORTED_OS_URL}
    rel="noreferrer"
    target="_blank"
    className={tw('text-label-primary underline')}
  >
    {parts}
  </a>
);

/** @testexport */
export function UnsupportedOSModal(props: {
  i18n: LocalizerType;
  OS: string;
  onClose: () => void;
}): ReactNode {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:InstallScreenUpdateDialog--unsupported-os__title')}
      description={
        <I18n
          id="icu:UnsupportedOSErrorDialog__body"
          i18n={i18n}
          components={{
            OS: props.OS,
            learnMoreLink,
          }}
        />
      }
    />
  );
}

/** @testexport */
export function CannotUpdateModal(props: {
  i18n: LocalizerType;
  onClose: () => void;
  currentVersion: string;
  needsManualUpdate: boolean;
  onStartUpdate: () => void;
}): ReactNode {
  const { i18n, onStartUpdate } = props;

  const url = isBeta(props.currentVersion)
    ? BETA_DOWNLOAD_URL
    : PRODUCTION_DOWNLOAD_URL;

  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:cannotUpdate')}
      description={
        <I18n
          i18n={i18n}
          id="icu:InstallScreenUpdateDialog--cannot-update__body"
          components={{
            downloadUrl: (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={tw('text-label-primary underline')}
              >
                {url}
              </a>
            ),
          }}
        />
      }
    >
      {!props.needsManualUpdate && (
        <AxoConfirmDialog.Action
          variant="primary"
          onClick={event => {
            event.preventDefault();
            onStartUpdate();
          }}
        >
          {i18n('icu:autoUpdateRetry')}
        </AxoConfirmDialog.Action>
      )}
    </AxoConfirmDialog.Root>
  );
}

/** @testexport */
export function CannotUpdateMacOsReadOnlyModal(props: {
  i18n: LocalizerType;
  onClose: () => void;
}): ReactNode {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:cannotUpdate')}
      description={
        <I18n
          components={{
            app: <strong key="app">Signal.app</strong>,
            folder: <strong key="folder">/Applications</strong>,
          }}
          i18n={i18n}
          id="icu:readOnlyVolume"
        />
      }
    />
  );
}
