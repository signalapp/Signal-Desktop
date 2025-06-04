// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups';
import type { LocalizerType } from '../types/I18N';
import { formatTimestamp } from '../util/formatTimestamp';
import { SettingsControl as Control, SettingsRow } from './PreferencesUtil';
import { missingCaseError } from '../util/missingCaseError';
import { Button, ButtonVariant } from './Button';
import type { PreferencesBackupPage } from '../types/PreferencesBackupPage';
import { Page } from './Preferences';
import { I18n } from './I18n';
import { PreferencesLocalBackups } from './PreferencesLocalBackups';
import type { ShowToastAction } from '../state/ducks/toast';

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
  page,
  setPage,
  showToast,
}: {
  accountEntropyPool: string | undefined;
  backupKeyViewed: boolean;
  backupSubscriptionStatus?: BackupsSubscriptionType;
  cloudBackupStatus?: BackupStatusType;
  localBackupFolder: string | undefined;
  i18n: LocalizerType;
  locale: string;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  page: PreferencesBackupPage;
  pickLocalBackupFolder: () => Promise<string | undefined>;
  setPage: (page: PreferencesBackupPage) => void;
  showToast: ShowToastAction;
}): JSX.Element {
  if (page === Page.BackupsDetails) {
    return (
      <BackupsDetailsPage
        i18n={i18n}
        cloudBackupStatus={cloudBackupStatus}
        backupSubscriptionStatus={backupSubscriptionStatus}
        locale={locale}
      />
    );
  }

  if (
    page === Page.LocalBackups ||
    page === Page.LocalBackupsKeyReference ||
    page === Page.LocalBackupsSetupFolder ||
    page === Page.LocalBackupsSetupKey
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

      {backupSubscriptionStatus ? (
        <SettingsRow className="Preferences--BackupsRow">
          <Control
            icon="Preferences__BackupsIcon"
            left={
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
            }
            right={
              <Button
                onClick={() => setPage(Page.BackupsDetails)}
                variant={ButtonVariant.Secondary}
              >
                {i18n('icu:Preferences__button--manage')}
              </Button>
            }
          />
        </SettingsRow>
      ) : (
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
      )}

      <SettingsRow
        className="Preferences--BackupsRow"
        title={i18n('icu:Preferences__backup-other-ways')}
      >
        <Control
          icon="Preferences__LocalBackupsIcon"
          left={
            <label>
              {i18n('icu:Preferences__local-backups')}{' '}
              <div className="Preferences__description">
                {isLocalBackupsSetup
                  ? null
                  : i18n('icu:Preferences--local-backups-off-description')}
              </div>
            </label>
          }
          right={
            <Button
              onClick={() => setPage(Page.LocalBackups)}
              variant={ButtonVariant.Secondary}
            >
              {isLocalBackupsSetup
                ? i18n('icu:Preferences__button--manage')
                : i18n('icu:Preferences__button--set-up')}
            </Button>
          }
        />
      </SettingsRow>
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
        {subscriptionStatus.renewalDate ? (
          <div className="Preferences--backups-summary__renewal-date">
            {i18n('icu:Preferences--backup-plan__renewal-date', {
              date: formatTimestamp(subscriptionStatus.renewalDate.getTime(), {
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
        {subscriptionStatus.expiryDate ? (
          <div className="Preferences--backups-summary__expiry-date">
            {i18n('icu:Preferences--backup-plan__expiry-date', {
              date: formatTimestamp(subscriptionStatus.expiryDate.getTime(), {
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
}: {
  cloudBackupStatus?: BackupStatusType;
  backupSubscriptionStatus?: BackupsSubscriptionType;
  i18n: LocalizerType;
  locale: string;
}): JSX.Element {
  return (
    <>
      <div className="Preferences--backups-summary__container">
        {renderBackupsSubscriptionDetails({
          subscriptionStatus: backupSubscriptionStatus,
          i18n,
          locale,
        })}
      </div>

      {cloudBackupStatus ? (
        <SettingsRow
          className="Preferences--backup-details"
          title={i18n('icu:Preferences--backup-details__header')}
        >
          {cloudBackupStatus.createdAt ? (
            <div className="Preferences--backup-details__row">
              <label>{i18n('icu:Preferences--backup-created-at__label')}</label>
              <div
                id="Preferences--backup-details__value"
                className="Preferences--backup-details__value"
              >
                {/* TODO (DESKTOP-8509) */}
                {i18n('icu:Preferences--backup-created-by-phone')}
                <span className="Preferences--backup-details__value-divider" />
                {formatTimestamp(cloudBackupStatus.createdAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>
          ) : null}
        </SettingsRow>
      ) : null}
    </>
  );
}
