// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode } from 'react';
import { isNumber } from 'lodash';

import { DialogType } from '../../types/Dialogs.std.ts';
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
import { tw } from '../../axo/tw.dom.tsx';
import { TitlebarDragArea } from '../TitlebarDragArea.dom.tsx';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo.dom.tsx';
import { ProgressBar } from '../ProgressBar.dom.tsx';

export type PropsType = UpdatesStateType &
  Readonly<{
    i18n: LocalizerType;
    forceCheck: () => void;
    startUpdate: () => void;
    currentVersion: string;
    OS: string;
    onClose?: () => void;
  }>;

export function InstallScreenUpdateDialog({
  i18n,
  dialogType,
  isCheckingForUpdates,
  downloadSize,
  downloadedSize,
  forceCheck,
  startUpdate,
  currentVersion,
  OS,
  onClose = () => null,
}: PropsType): JSX.Element | null {
  let modal: ReactNode | undefined = undefined;
  let inlineElement: ReactNode | undefined = undefined;

  if (dialogType === DialogType.None) {
    if (isCheckingForUpdates) {
      inlineElement = (
        <CenteredElement>
          <div className={tw('mb-[17px] w-82')}>
            <div
              className={tw('mb-4 text-center type-title-medium font-semibold')}
            >
              {i18n('icu:InstallScreenUpdateDialog--checking-for-updates')}
            </div>
            <ProgressBar
              fractionComplete={null}
              isRTL={i18n.getLocaleDirection() === 'rtl'}
            />
          </div>
        </CenteredElement>
      );
    } else {
      modal = (
        <UpdateRequiredModal
          isMas={false}
          i18n={i18n}
          onClose={onClose}
          onAction={forceCheck}
        />
      );
    }
  } else if (dialogType === DialogType.UnsupportedOS) {
    modal = <UnsupportedOSModal i18n={i18n} onClose={onClose} OS={OS} />;
  } else if (dialogType === DialogType.MASUpdate) {
    modal = (
      <UpdateRequiredModal
        isMas
        i18n={i18n}
        onClose={onClose}
        onAction={startUpdate}
      />
    );
  } else if (dialogType === DialogType.DownloadedUpdate) {
    modal = (
      <UpdateDownloadedModal
        i18n={i18n}
        onClose={onClose}
        onStartUpdate={startUpdate}
      />
    );
  } else if (
    dialogType === DialogType.AutoUpdate ||
    // Manual update with an action button
    dialogType === DialogType.DownloadReady ||
    dialogType === DialogType.FullDownloadReady
  ) {
    modal = (
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
  } else if (dialogType === DialogType.Downloading) {
    const fractionComplete = downloadSize
      ? roundFractionForProgressBar((downloadedSize || 0) / downloadSize)
      : null;
    inlineElement = (
      <CenteredElement>
        <div className={tw('mb-4 text-center type-title-medium font-semibold')}>
          {i18n('icu:InstallScreenUpdateDialog--updating-signal')}
        </div>
        <div className={tw('mb-[17px] w-82')}>
          <ProgressBar
            fractionComplete={fractionComplete}
            isRTL={i18n.getLocaleDirection() === 'rtl'}
          />
        </div>
        {isNumber(fractionComplete) ? (
          <div className={tw('mb-1.5 text-center type-caption font-medium')}>
            {i18n('icu:InstallScreenUpdateDialog--download-progress', {
              currentBytes: formatFileSize(downloadedSize ?? 0),
              totalBytes: formatFileSize(downloadSize ?? 1),
              percentage: fractionComplete,
            })}
          </div>
        ) : undefined}
      </CenteredElement>
    );
  } else if (
    dialogType === DialogType.Cannot_Update ||
    dialogType === DialogType.Cannot_Update_Require_Manual
  ) {
    modal = (
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
  } else if (dialogType === DialogType.MacOS_Read_Only) {
    modal = <CannotUpdateMacOsReadOnlyModal i18n={i18n} onClose={onClose} />;
  } else {
    throw missingCaseError(dialogType);
  }

  return (
    <div className="InstallScreenUpdateDialog">
      <TitlebarDragArea />
      <InstallScreenSignalLogo />
      {modal}
      {inlineElement}
    </div>
  );
}

function CenteredElement({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      className={tw(
        // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
        'left-1/2',
        'absolute top-1/2 max-w-[calc(100%-32px)] -translate-1/2'
      )}
    >
      {children}
    </div>
  );
}

function UpdateRequiredModal(props: {
  isMas: boolean;
  i18n: LocalizerType;
  onClose: () => void;
  onAction: () => void;
}): ReactNode {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:InstallScreenUpdateDialog--update-required__title')}
      description={i18n('icu:InstallScreenUpdateDialog--update-required__body')}
    >
      <AxoConfirmDialog.Action
        variant="strong-primary"
        onClick={props.onAction}
      >
        {props.isMas
          ? i18n(
              'icu:InstallScreenUpdateDialog--update-required__action-update__mas'
            )
          : i18n(
              'icu:InstallScreenUpdateDialog--update-required__action-update'
            )}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

function UpdateAvailableModal(props: {
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
        variant="strong-primary"
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

function UpdateDownloadedModal(props: {
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
        variant="strong-primary"
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
    className={tw('text-primary underline')}
  >
    {parts}
  </a>
);

function UnsupportedOSModal(props: {
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

function CannotUpdateModal(props: {
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
                className={tw('text-primary underline')}
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
          variant="strong-primary"
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

function CannotUpdateMacOsReadOnlyModal(props: {
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
