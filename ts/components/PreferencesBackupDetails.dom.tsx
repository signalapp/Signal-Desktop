// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type {
  BackupMediaDownloadStatusType,
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups.node.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { formatTimestamp } from '../util/formatTimestamp.dom.js';
import { SettingsRow } from './PreferencesUtil.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { BackupMediaDownloadProgressSettings } from './BackupMediaDownloadProgressSettings.dom.js';
import { BackupLevel } from '../services/backups/types.std.js';
import { SpinnerV2 } from './SpinnerV2.dom.js';
import { MINUTE } from '../util/durations/constants.std.js';
import { isOlderThan } from '../util/timestamp.std.js';

// We'll show a loading spinner if we are fetching fresh data and cached data is older
// than this duration
const SUBSCRIPTION_STATUS_STALE_TIME_FOR_UI = 5 * MINUTE;

export function BackupsDetailsPage({
  cloudBackupStatus,
  backupFreeMediaDays,
  backupSubscriptionStatus,
  backupTier,
  i18n,
  locale,
  cancelBackupMediaDownload,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  backupMediaDownloadStatus,
}: {
  cloudBackupStatus?: BackupStatusType;
  backupFreeMediaDays: number;
  backupSubscriptionStatus: BackupsSubscriptionType;
  backupTier: BackupLevel | null;
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
        {backupTier === BackupLevel.Paid
          ? renderPaidBackupDetailsSummary({
              subscriptionStatus: backupSubscriptionStatus,
              i18n,
              locale,
            })
          : null}
        {backupTier === BackupLevel.Free
          ? renderFreeBackupDetailsSummary({
              backupFreeMediaDays,
              i18n,
            })
          : null}
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

function renderPaidBackupDetailsSummary({
  subscriptionStatus,
  i18n,
  locale,
}: {
  locale: string;
  subscriptionStatus?: BackupsSubscriptionType;
  i18n: LocalizerType;
}): JSX.Element | null {
  return (
    <>
      <div className="Preferences--backups-summary__status-container">
        <div>
          <div className="Preferences--backups-summary__type">
            {i18n('icu:Preferences--backup-media-plan__description')}
          </div>
          <div className="Preferences--backups-summary__content">
            {subscriptionStatus
              ? renderSubscriptionDetails({ i18n, locale, subscriptionStatus })
              : null}
          </div>
        </div>
        {getSubscriptionStatusIcon(subscriptionStatus)}
      </div>
      <div className="Preferences--backups-summary__note">
        {getSubscriptionNote(i18n, subscriptionStatus)}
      </div>
    </>
  );
}

function getSubscriptionNote(
  i18n: LocalizerType,
  subscriptionStatus: BackupsSubscriptionType | undefined
) {
  const status = subscriptionStatus?.status;
  switch (status) {
    case 'active':
    case 'pending-cancellation':
      return i18n('icu:Preferences--backup-media-plan__note');
    case 'not-found':
    case 'expired':
    case undefined:
      return i18n('icu:Preferences--backup-plan__not-found__note');
    default:
      throw missingCaseError(status);
  }
}

function getSubscriptionStatusIcon(
  subscriptionStatus: BackupsSubscriptionType | undefined
) {
  const status = subscriptionStatus?.status;
  switch (status) {
    case 'active':
      return (
        <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--active" />
      );
    case 'pending-cancellation':
    case 'not-found':
    case 'expired':
    case undefined:
      return (
        <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--inactive" />
      );
    default:
      throw missingCaseError(status);
  }
}

function renderFreeBackupDetailsSummary({
  backupFreeMediaDays,
  i18n,
}: {
  backupFreeMediaDays: number;
  i18n: LocalizerType;
}): JSX.Element | null {
  return (
    <>
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
        <div className="Preferences--backups-summary__icon Preferences--backups-summary__icon--active" />
      </div>
      <div className="Preferences--backups-summary__note">
        {i18n('icu:Preferences--backup-messages-plan__note')}
      </div>
    </>
  );
}

export function renderSubscriptionDetails({
  i18n,
  subscriptionStatus,
  locale,
}: {
  i18n: LocalizerType;
  locale: string;
  subscriptionStatus: BackupsSubscriptionType;
}): JSX.Element | null {
  const { status } = subscriptionStatus;
  if (
    subscriptionStatus.isFetching &&
    isOlderThan(
      subscriptionStatus.lastFetchedAtMs ?? 0,
      SUBSCRIPTION_STATUS_STALE_TIME_FOR_UI
    )
  ) {
    return (
      <SpinnerV2 variant="no-background-light" size={24} strokeWidth={3} />
    );
  }

  switch (status) {
    case 'active':
      return (
        <>
          {subscriptionStatus.cost ? (
            <div className="Preferences--backups-summary__subscription-price">
              {i18n('icu:Preferences--backup-subscription-monthly-cost', {
                cost: new Intl.NumberFormat(locale, {
                  style: 'currency',
                  currency: subscriptionStatus.cost.currencyCode,
                  currencyDisplay: 'narrowSymbol',
                }).format(subscriptionStatus.cost.amount),
              })}
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

    case 'pending-cancellation':
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
    case 'not-found':
    case 'expired':
      return (
        <div className="Preferences--backups-summary__status-container">
          <div className="Preferences--backups-summary__content">
            {i18n('icu:Preferences--backup-plan-not-found__description')}
          </div>
        </div>
      );
    default:
      throw missingCaseError(status);
  }
}
