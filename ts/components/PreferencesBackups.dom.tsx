// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import type {
  BackupMediaDownloadStatusType,
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups.node.js';
import type { LocalizerType } from '../types/I18N.std.js';
import {
  SettingsControl as Control,
  FlowingSettingsControl as FlowingControl,
  LightIconLabel,
  SettingsRow,
} from './PreferencesUtil.dom.js';
import type { SettingsLocation } from '../types/Nav.std.js';
import { SettingsPage } from '../types/Nav.std.js';
import { I18n } from './I18n.dom.js';
import { PreferencesLocalBackups } from './PreferencesLocalBackups.dom.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain.main.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { BackupLevel } from '../services/backups/types.std.js';
import {
  BackupsDetailsPage,
  renderSubscriptionDetails,
} from './PreferencesBackupDetails.dom.js';
import type { LocalBackupExportMetadata } from '../types/LocalExport.std.js';

export const SIGNAL_BACKUPS_LEARN_MORE_URL =
  'https://support.signal.org/hc/articles/360007059752-Backup-and-Restore-Messages';

const LOCAL_BACKUPS_PAGES = new Set([
  SettingsPage.LocalBackups,
  SettingsPage.LocalBackupsKeyReference,
  SettingsPage.LocalBackupsSetupFolder,
  SettingsPage.LocalBackupsSetupKey,
]);

function isLocalBackupsPage(page: SettingsPage) {
  return LOCAL_BACKUPS_PAGES.has(page);
}

export function PreferencesBackups({
  accountEntropyPool,
  backupFreeMediaDays,
  backupKeyViewed,
  backupSubscriptionStatus,
  backupTier,
  cloudBackupStatus,
  i18n,
  isLocalBackupsEnabled,
  lastLocalBackup,
  locale,
  localBackupFolder,
  onBackupKeyViewedChange,
  openFileInFolder,
  osName,
  pickLocalBackupFolder,
  disableLocalBackups,
  backupMediaDownloadStatus,
  cancelBackupMediaDownload,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  settingsLocation,
  promptOSAuth,
  refreshCloudBackupStatus,
  refreshBackupSubscriptionStatus,
  setSettingsLocation,
  showToast,
  startLocalBackupExport,
}: {
  accountEntropyPool: string | undefined;
  backupFreeMediaDays: number;
  backupKeyViewed: boolean;
  backupSubscriptionStatus: BackupsSubscriptionType;
  backupTier: BackupLevel | null;
  cloudBackupStatus?: BackupStatusType;
  localBackupFolder: string | undefined;
  i18n: LocalizerType;
  isLocalBackupsEnabled: boolean;
  lastLocalBackup: LocalBackupExportMetadata | undefined;
  locale: string;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  openFileInFolder: (path: string) => void;
  osName: 'linux' | 'macos' | 'windows' | undefined;
  settingsLocation: SettingsLocation;
  backupMediaDownloadStatus: BackupMediaDownloadStatusType | undefined;
  cancelBackupMediaDownload: () => void;
  disableLocalBackups: ({
    deleteExistingBackups,
  }: {
    deleteExistingBackups: boolean;
  }) => Promise<void>;
  pauseBackupMediaDownload: () => void;
  resumeBackupMediaDownload: () => void;
  pickLocalBackupFolder: () => Promise<string | undefined>;
  promptOSAuth: (
    reason: PromptOSAuthReasonType
  ) => Promise<PromptOSAuthResultType>;
  refreshCloudBackupStatus: () => void;
  refreshBackupSubscriptionStatus: () => void;
  setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  showToast: ShowToastAction;
  startLocalBackupExport: () => void;
}): React.JSX.Element | null {
  const [isAuthPending, setIsAuthPending] = useState<boolean>(false);

  useEffect(() => {
    if (settingsLocation.page === SettingsPage.Backups) {
      refreshBackupSubscriptionStatus();
    } else if (settingsLocation.page === SettingsPage.BackupsDetails) {
      refreshBackupSubscriptionStatus();
      refreshCloudBackupStatus();
    }
  }, [
    settingsLocation.page,
    refreshBackupSubscriptionStatus,
    refreshCloudBackupStatus,
  ]);

  if (!isLocalBackupsEnabled && isLocalBackupsPage(settingsLocation.page)) {
    setSettingsLocation({ page: SettingsPage.Backups });
    return null;
  }

  if (settingsLocation.page === SettingsPage.BackupsDetails) {
    if (backupTier == null) {
      setSettingsLocation({ page: SettingsPage.Backups });
      return null;
    }
    return (
      <BackupsDetailsPage
        i18n={i18n}
        cloudBackupStatus={cloudBackupStatus}
        backupTier={backupTier}
        backupFreeMediaDays={backupFreeMediaDays}
        backupSubscriptionStatus={backupSubscriptionStatus}
        backupMediaDownloadStatus={backupMediaDownloadStatus}
        cancelBackupMediaDownload={cancelBackupMediaDownload}
        pauseBackupMediaDownload={pauseBackupMediaDownload}
        resumeBackupMediaDownload={resumeBackupMediaDownload}
        locale={locale}
      />
    );
  }

  if (isLocalBackupsPage(settingsLocation.page)) {
    return (
      <PreferencesLocalBackups
        accountEntropyPool={accountEntropyPool}
        backupKeyViewed={backupKeyViewed}
        i18n={i18n}
        lastLocalBackup={lastLocalBackup}
        localBackupFolder={localBackupFolder}
        onBackupKeyViewedChange={onBackupKeyViewedChange}
        openFileInFolder={openFileInFolder}
        osName={osName}
        settingsLocation={settingsLocation}
        pickLocalBackupFolder={pickLocalBackupFolder}
        disableLocalBackups={disableLocalBackups}
        promptOSAuth={promptOSAuth}
        setSettingsLocation={setSettingsLocation}
        showToast={showToast}
        startLocalBackupExport={startLocalBackupExport}
      />
    );
  }

  const learnMoreLink = (parts: Array<string | React.JSX.Element>) => (
    <a href={SIGNAL_BACKUPS_LEARN_MORE_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

  const isLocalBackupsSetup = localBackupFolder && backupKeyViewed;

  function renderRemoteBackups() {
    return (
      <>
        {backupTier == null ? (
          <SettingsRow className="Preferences--BackupsRow">
            <Control
              icon="Preferences__BackupsIcon"
              left={
                <label>
                  {i18n('icu:Preferences--signal-backups')}{' '}
                  <div className="Preferences--backup-details__value">
                    <I18n
                      id="icu:Preferences--signal-backups-off-description"
                      i18n={i18n}
                      components={{
                        learnMoreLink,
                      }}
                    />
                  </div>
                </label>
              }
              right={null}
            />
          </SettingsRow>
        ) : (
          <SettingsRow className="Preferences--BackupsRow">
            <FlowingControl>
              <div className="Preferences__two-thirds-flow">
                <LightIconLabel icon="Preferences__BackupsIcon">
                  <label>
                    {i18n('icu:Preferences--signal-backups')}
                    <div className="Preferences__description">
                      {backupTier === BackupLevel.Paid
                        ? renderPaidBackupsSummary({
                            subscriptionStatus: backupSubscriptionStatus,
                            i18n,
                            locale,
                          })
                        : null}
                      {backupTier === BackupLevel.Free
                        ? renderFreeBackupsSummary({
                            i18n,
                            backupFreeMediaDays,
                          })
                        : null}
                    </div>
                  </label>
                </LightIconLabel>
              </div>
              <div
                className={classNames(
                  'Preferences__flow-button',
                  'Preferences__one-third-flow',
                  'Preferences__one-third-flow--align-right'
                )}
              >
                <AxoButton.Root
                  variant="secondary"
                  size="lg"
                  onClick={() =>
                    setSettingsLocation({ page: SettingsPage.BackupsDetails })
                  }
                >
                  {i18n('icu:Preferences__button--manage')}
                </AxoButton.Root>
              </div>
            </FlowingControl>
          </SettingsRow>
        )}
      </>
    );
  }

  function renderLocalBackups() {
    return (
      <SettingsRow
        className="Preferences--BackupsRow"
        title={i18n('icu:Preferences__backup-other-ways')}
      >
        <FlowingControl>
          <div className="Preferences__two-thirds-flow">
            <LightIconLabel icon="Preferences__LocalBackupsIcon">
              <label>
                {i18n('icu:Preferences__local-backups')}{' '}
                <div className="Preferences__description">
                  {i18n('icu:Preferences--local-backups-off-description')}
                </div>
              </label>
            </LightIconLabel>
          </div>
          <div
            className={classNames(
              'Preferences__flow-button',
              'Preferences__one-third-flow',
              'Preferences__one-third-flow--align-right'
            )}
          >
            <AxoButton.Root
              variant="secondary"
              size="lg"
              disabled={isAuthPending}
              onClick={async () => {
                if (!isLocalBackupsSetup) {
                  try {
                    setIsAuthPending(true);
                    const result = await promptOSAuth('enable-backups');
                    if (result !== 'success' && result !== 'unsupported') {
                      return;
                    }
                  } finally {
                    setIsAuthPending(false);
                  }
                }
                setSettingsLocation({ page: SettingsPage.LocalBackups });
              }}
            >
              {isLocalBackupsSetup
                ? i18n('icu:Preferences__button--manage')
                : i18n('icu:Preferences__button--set-up')}
            </AxoButton.Root>
          </div>
        </FlowingControl>
      </SettingsRow>
    );
  }

  return (
    <>
      <div className="Preferences__padding">
        <div className="Preferences__description Preferences__description--medium">
          {i18n('icu:Preferences--backup-section-description')}
        </div>
      </div>
      {renderRemoteBackups()}
      {isLocalBackupsEnabled ? renderLocalBackups() : null}
    </>
  );
}

export function renderPaidBackupsSummary({
  subscriptionStatus,
  i18n,
  locale,
}: {
  locale: string;
  subscriptionStatus: BackupsSubscriptionType;
  i18n: LocalizerType;
}): React.JSX.Element | null {
  return (
    <div className="Preferences--backups-summary__status-container">
      <div>
        <div className="Preferences--backups-summary__type">
          {i18n('icu:Preferences--backup-media-plan__description')}
        </div>
        <div className="Preferences--backups-summary__content">
          {renderSubscriptionDetails({ i18n, locale, subscriptionStatus })}
        </div>
      </div>
    </div>
  );
}

export function renderFreeBackupsSummary({
  backupFreeMediaDays,
  i18n,
}: {
  backupFreeMediaDays: number;
  i18n: LocalizerType;
}): React.JSX.Element | null {
  return (
    <div className="Preferences--backups-summary__status-container">
      <div>
        <div className="Preferences--backups-summary__type">
          {i18n('icu:Preferences--backup-messages-plan__description', {
            mediaDayCount: backupFreeMediaDays,
          })}
        </div>
        <div className="Preferences--backups-summary__content">
          {i18n('icu:Preferences--backup-messages-plan__cost-description')}
        </div>
      </div>
    </div>
  );
}
