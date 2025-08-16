// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import type {
  BackupMediaDownloadStatusType,
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups';
import type { LocalizerType } from '../types/I18N';
import { formatTimestamp } from '../util/formatTimestamp';
import {
  SettingsControl as Control,
  FlowingSettingsControl as FlowingControl,
  LightIconLabel,
  SettingsRow,
} from './PreferencesUtil';
import { missingCaseError } from '../util/missingCaseError';
import { Button, ButtonVariant } from './Button';
import type { PreferencesBackupPage } from '../types/PreferencesBackupPage';
import { SettingsPage } from '../types/Nav';
import { I18n } from './I18n';
import { PreferencesLocalBackups } from './PreferencesLocalBackups';
import type { ShowToastAction } from '../state/ducks/toast';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain';
import { ConfirmationDialog } from './ConfirmationDialog';
import { BackupMediaDownloadProgressSettings } from './BackupMediaDownloadProgressSettings';

export const SIGNAL_BACKUPS_LEARN_MORE_URL =
  'https://support.signal.org/hc/articles/360007059752-Backup-and-Restore-Messages';

export function PreferencesBackups({
  accountEntropyPool,
  backupKeyViewed,
  backupSubscriptionStatus,
  cloudBackupStatus,
  i18n,
  locale,
  localBackupFolder,
  onBackupKeyViewedChange,
  pickLocalBackupFolder,
  backupMediaDownloadStatus,
  cancelBackupMediaDownload,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  page,
  promptOSAuth,
  refreshCloudBackupStatus,
  refreshBackupSubscriptionStatus,
  setPage,
  showToast,
}: {
  accountEntropyPool: string | undefined;
  backupKeyViewed: boolean;
  backupSubscriptionStatus: BackupsSubscriptionType;
  cloudBackupStatus?: BackupStatusType;
  localBackupFolder: string | undefined;
  i18n: LocalizerType;
  locale: string;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  page: PreferencesBackupPage;
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
  setPage: (page: PreferencesBackupPage) => void;
  showToast: ShowToastAction;
}): JSX.Element | null {
  const [authError, setAuthError] =
    useState<Omit<PromptOSAuthResultType, 'success'>>();
  const [isAuthPending, setIsAuthPending] = useState<boolean>(false);

  useEffect(() => {
    if (page === SettingsPage.Backups) {
      refreshBackupSubscriptionStatus();
    } else if (page === SettingsPage.BackupsDetails) {
      refreshBackupSubscriptionStatus();
      refreshCloudBackupStatus();
    }
  }, [page, refreshBackupSubscriptionStatus, refreshCloudBackupStatus]);

  if (page === SettingsPage.BackupsDetails) {
    if (backupSubscriptionStatus.status === 'off') {
      setPage(SettingsPage.Backups);
      return null;
    }
    return (
      <BackupsDetailsPage
        i18n={i18n}
        cloudBackupStatus={cloudBackupStatus}
        backupSubscriptionStatus={backupSubscriptionStatus}
        backupMediaDownloadStatus={backupMediaDownloadStatus}
        cancelBackupMediaDownload={cancelBackupMediaDownload}
        pauseBackupMediaDownload={pauseBackupMediaDownload}
        resumeBackupMediaDownload={resumeBackupMediaDownload}
        locale={locale}
      />
    );
  }

  if (
    page === SettingsPage.LocalBackups ||
    page === SettingsPage.LocalBackupsKeyReference ||
    page === SettingsPage.LocalBackupsSetupFolder ||
    page === SettingsPage.LocalBackupsSetupKey
  ) {
    return (
      <PreferencesLocalBackups
        accountEntropyPool={accountEntropyPool}
        backupKeyViewed={backupKeyViewed}
        i18n={i18n}
        localBackupFolder={localBackupFolder}
        onBackupKeyViewedChange={onBackupKeyViewedChange}
        page={page}
        pickLocalBackupFolder={pickLocalBackupFolder}
        promptOSAuth={promptOSAuth}
        setPage={setPage}
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

  return (
    <>
      <div className="Preferences__padding">
        <div className="Preferences__description Preferences__description--medium">
          {i18n('icu:Preferences--backup-section-description')}
        </div>
      </div>

      {backupSubscriptionStatus.status === 'off' ? (
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
                  {i18n('icu:Preferences--signal-backups')}{' '}
                  <div className="Preferences__description">
                    {renderBackupsSubscriptionSummary({
                      subscriptionStatus: backupSubscriptionStatus,
                      i18n,
                      locale,
                    })}
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
              <Button
                onClick={() => setPage(SettingsPage.BackupsDetails)}
                variant={ButtonVariant.Secondary}
              >
                {i18n('icu:Preferences__button--manage')}
              </Button>
            </div>
          </FlowingControl>
        </SettingsRow>
      )}

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
            <Button
              className="Preferences--BackupsAuthButton"
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

                setPage(SettingsPage.LocalBackups);
              }}
              variant={ButtonVariant.Secondary}
            >
              {isLocalBackupsSetup
                ? i18n('icu:Preferences__button--manage')
                : i18n('icu:Preferences__button--set-up')}
            </Button>
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

function getSubscriptionDetails({
  i18n,
  subscriptionStatus,
  locale,
}: {
  i18n: LocalizerType;
  locale: string;
  subscriptionStatus: BackupsSubscriptionType;
}): JSX.Element | null {
  if (subscriptionStatus.status === 'active') {
    return (
      <>
        {subscriptionStatus.cost ? (
          <div className="Preferences--backups-summary__subscription-price">
            {new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: subscriptionStatus.cost.currencyCode,
              currencyDisplay: 'narrowSymbol',
            }).format(subscriptionStatus.cost.amount)}{' '}
            / month
          </div>
        ) : null}
        {subscriptionStatus.renewalTimestamp ? (
          <div className="Preferences--backups-summary__renewal-date">
            {i18n('icu:Preferences--backup-plan__renewal-date', {
              date: formatTimestamp(subscriptionStatus.renewalTimestamp, {
                dateStyle: 'medium',
              }),
            })}
          </div>
        ) : null}
      </>
    );
  }
  if (subscriptionStatus.status === 'pending-cancellation') {
    return (
      <>
        <div className="Preferences--backups-summary__canceled">
          {i18n('icu:Preferences--backup-plan__canceled')}
        </div>
        {subscriptionStatus.expiryTimestamp ? (
          <div className="Preferences--backups-summary__expiry-date">
            {i18n('icu:Preferences--backup-plan__expiry-date', {
              date: formatTimestamp(subscriptionStatus.expiryTimestamp, {
                dateStyle: 'medium',
              }),
            })}
          </div>
        ) : null}
      </>
    );
  }

  return null;
}

export function renderBackupsSubscriptionDetails({
  subscriptionStatus,
  i18n,
  locale,
}: {
  locale: string;
  subscriptionStatus?: BackupsSubscriptionType;
  i18n: LocalizerType;
}): JSX.Element | null {
  if (!subscriptionStatus) {
    return null;
  }

  const { status } = subscriptionStatus;
  switch (status) {
    case 'off':
      return null;
    case 'active':
    case 'pending-cancellation':
      return (
        <>
          <div className="Preferences--backups-summary__status-container">
            <div>
              <div className="Preferences--backups-summary__type">
                {i18n('icu:Preferences--backup-media-plan__description')}
              </div>
              <div className="Preferences--backups-summary__content">
                {getSubscriptionDetails({ i18n, locale, subscriptionStatus })}
              </div>
            </div>
            {subscriptionStatus.status === 'active' ? (
              <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--active" />
            ) : (
              <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--inactive" />
            )}
          </div>
          <div className="Preferences--backups-summary__note">
            {i18n('icu:Preferences--backup-media-plan__note')}
          </div>
        </>
      );
    case 'free':
      return (
        <>
          <div className="Preferences--backups-summary__status-container">
            <div>
              <div className="Preferences--backups-summary__type">
                {i18n('icu:Preferences--backup-messages-plan__description', {
                  mediaDayCount:
                    subscriptionStatus.mediaIncludedInBackupDurationDays,
                })}
              </div>
              <div className="Preferences--backups-summary__content">
                {i18n(
                  'icu:Preferences--backup-messages-plan__cost-description'
                )}
              </div>
            </div>
            <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--active" />
          </div>
          <div className="Preferences--backups-summary__note">
            {i18n('icu:Preferences--backup-messages-plan__note')}
          </div>
        </>
      );
    case 'not-found':
    case 'expired':
      return (
        <>
          <div className="Preferences--backups-summary__status-container ">
            <div className="Preferences--backups-summary__content">
              {i18n('icu:Preferences--backup-plan-not-found__description')}
            </div>
            <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--inactive" />
          </div>
          <div className="Preferences--backups-summary__note">
            <div className="Preferences--backups-summary__note">
              {i18n('icu:Preferences--backup-plan__not-found__note')}
            </div>
          </div>
        </>
      );
    default:
      throw missingCaseError(status);
  }
}

export function renderBackupsSubscriptionSummary({
  subscriptionStatus,
  i18n,
  locale,
}: {
  locale: string;
  subscriptionStatus?: BackupsSubscriptionType;
  i18n: LocalizerType;
}): JSX.Element | null {
  if (!subscriptionStatus) {
    return null;
  }

  const { status } = subscriptionStatus;
  switch (status) {
    case 'off':
      return null;
    case 'active':
    case 'pending-cancellation':
      return (
        <div className="Preferences--backups-summary__status-container">
          <div>
            <div className="Preferences--backups-summary__type">
              {i18n('icu:Preferences--backup-media-plan__description')}
            </div>
            <div className="Preferences--backups-summary__content">
              {getSubscriptionDetails({ i18n, locale, subscriptionStatus })}
            </div>
          </div>
        </div>
      );
    case 'free':
      return (
        <div className="Preferences--backups-summary__status-container">
          <div>
            <div className="Preferences--backups-summary__type">
              {i18n('icu:Preferences--backup-messages-plan__description', {
                mediaDayCount:
                  subscriptionStatus.mediaIncludedInBackupDurationDays,
              })}
            </div>
            <div className="Preferences--backups-summary__content">
              {i18n('icu:Preferences--backup-messages-plan__cost-description')}
            </div>
          </div>
        </div>
      );
    case 'not-found':
    case 'expired':
      return (
        <div className="Preferences--backups-summary__status-container ">
          <div className="Preferences--backups-summary__content">
            {i18n('icu:Preferences--backup-plan-not-found__description')}
          </div>
        </div>
      );
    default:
      throw missingCaseError(status);
  }
}

function BackupsDetailsPage({
  cloudBackupStatus,
  backupSubscriptionStatus,
  i18n,
  locale,
  cancelBackupMediaDownload,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  backupMediaDownloadStatus,
}: {
  cloudBackupStatus?: BackupStatusType;
  backupSubscriptionStatus: BackupsSubscriptionType;
  i18n: LocalizerType;
  locale: string;
  cancelBackupMediaDownload: () => void;
  pauseBackupMediaDownload: () => void;
  resumeBackupMediaDownload: () => void;
  backupMediaDownloadStatus?: BackupMediaDownloadStatusType;
}): JSX.Element {
  const shouldShowMediaProgress =
    backupMediaDownloadStatus &&
    backupMediaDownloadStatus.completedBytes <
      backupMediaDownloadStatus.totalBytes;

  return (
    <>
      <div className="Preferences--backups-summary__container">
        {renderBackupsSubscriptionDetails({
          subscriptionStatus: backupSubscriptionStatus,
          i18n,
          locale,
        })}
      </div>

      {cloudBackupStatus || shouldShowMediaProgress ? (
        <SettingsRow
          className="Preferences--backup-details"
          title={i18n('icu:Preferences--backup-details__header')}
        >
          {cloudBackupStatus?.createdTimestamp ? (
            <div className="Preferences--backup-details__row">
              <label>{i18n('icu:Preferences--backup-created-at__label')}</label>
              <div
                id="Preferences--backup-details__value"
                className="Preferences--backup-details__value"
              >
                {/* TODO (DESKTOP-8509) */}
                {i18n('icu:Preferences--backup-created-by-phone')}
                <span className="Preferences--backup-details__value-divider" />
                {formatTimestamp(cloudBackupStatus.createdTimestamp, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>
          ) : null}
          {shouldShowMediaProgress && backupMediaDownloadStatus ? (
            <div className="Preferences--backup-details__row">
              <BackupMediaDownloadProgressSettings
                {...backupMediaDownloadStatus}
                handleCancel={cancelBackupMediaDownload}
                handlePause={pauseBackupMediaDownload}
                handleResume={resumeBackupMediaDownload}
                i18n={i18n}
              />
            </div>
          ) : null}
        </SettingsRow>
      ) : null}
    </>
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
