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
import { ButtonVariant } from './Button.dom.js';
import type { SettingsLocation } from '../types/Nav.std.js';
import { SettingsPage } from '../types/Nav.std.js';
import { I18n } from './I18n.dom.js';
import { PreferencesLocalBackups } from './PreferencesLocalBackups.dom.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain.main.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { BackupLevel } from '../services/backups/types.std.js';
import {
  BackupsDetailsPage,
  renderSubscriptionDetails,
} from './PreferencesBackupDetails.dom.js';

export const SIGNAL_BACKUPS_LEARN_MORE_URL =
  'https://support.signal.org/hc/articles/360007059752-Backup-and-Restore-Messages';

const LOCAL_BACKUPS_PAGES = new Set([
  SettingsPage.LocalBackups,
  SettingsPage.LocalBackupsKeyReference,
  SettingsPage.LocalBackupsSetupFolder,
  SettingsPage.LocalBackupsSetupKey,
]);
const REMOTE_BACKUPS_PAGES = new Set([SettingsPage.BackupsDetails]);

function isLocalBackupsPage(page: SettingsPage) {
  return LOCAL_BACKUPS_PAGES.has(page);
}
function isRemoteBackupsPage(page: SettingsPage) {
  return REMOTE_BACKUPS_PAGES.has(page);
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
  isRemoteBackupsEnabled,
  locale,
  localBackupFolder,
  onBackupKeyViewedChange,
  pickLocalBackupFolder,
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
  isRemoteBackupsEnabled: boolean;
  locale: string;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  settingsLocation: SettingsLocation;
  backupMediaDownloadStatus: BackupMediaDownloadStatusType | undefined;
  cancelBackupMediaDownload: () => void;
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
}): JSX.Element | null {
  const [authError, setAuthError] =
    useState<Omit<PromptOSAuthResultType, 'success'>>();
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

  if (!isRemoteBackupsEnabled && isRemoteBackupsPage(settingsLocation.page)) {
    setSettingsLocation({ page: SettingsPage.Backups });
    return null;
  }

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
        localBackupFolder={localBackupFolder}
        onBackupKeyViewedChange={onBackupKeyViewedChange}
        settingsLocation={settingsLocation}
        pickLocalBackupFolder={pickLocalBackupFolder}
        promptOSAuth={promptOSAuth}
        setSettingsLocation={setSettingsLocation}
        showToast={showToast}
      />
    );
  }

  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
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
                  size="large"
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
      <>
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
                    {isLocalBackupsSetup
                      ? null
                      : i18n('icu:Preferences--local-backups-off-description')}
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
                size="large"
                disabled={isAuthPending}
                onClick={async () => {
                  setAuthError(undefined);

                  if (!isLocalBackupsSetup) {
                    try {
                      setIsAuthPending(true);
                      const result = await promptOSAuth('enable-backups');
                      if (result !== 'success' && result !== 'unsupported') {
                        setAuthError(result);
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

        {authError && (
          <ConfirmationDialog
            i18n={i18n}
            dialogName="PreferencesLocalBackups--ErrorDialog"
            onClose={() => setAuthError(undefined)}
            cancelButtonVariant={ButtonVariant.Secondary}
            cancelText={i18n('icu:ok')}
          >
            {getOSAuthErrorString(authError) ?? i18n('icu:error')}
          </ConfirmationDialog>
        )}
      </>
    );
  }

  return (
    <>
      <div className="Preferences__padding">
        <div className="Preferences__description Preferences__description--medium">
          {i18n('icu:Preferences--backup-section-description')}
        </div>
      </div>

      {isRemoteBackupsEnabled ? renderRemoteBackups() : null}
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
}): JSX.Element | null {
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
}): JSX.Element | null {
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

export function getOSAuthErrorString(
  authError: Omit<PromptOSAuthResultType, 'success'> | undefined
): string | undefined {
  if (!authError) {
    return undefined;
  }

  // TODO: DESKTOP-8895
  if (authError === 'unauthorized') {
    return 'This action could not be completed because system authentication failed. Please try again or open the Signal app on your mobile device and go to Backup Settings to view your backup key.';
  }

  if (authError === 'unauthorized-no-windows-ucv') {
    return 'This action could not be completed because Windows Hello is not enabled on your computer. Please set up Windows Hello and try again, or open the Signal app on your mobile device and go to Backup Settings to view your backup key.';
  }

  return 'The action could not be completed because authentication is not available on this computer. Please open the Signal app on your mobile device and go to Backup Settings to view your backup key.';
}
