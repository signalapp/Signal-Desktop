// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups';
import type { LocalizerType } from '../types/I18N';
import { formatTimestamp } from '../util/formatTimestamp';
import { formatFileSize } from '../util/formatFileSize';
import { SettingsRow } from './PreferencesUtil';
import { missingCaseError } from '../util/missingCaseError';

export function PreferencesBackups({
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
      <div className="Preferences__title Preferences__title--backups">
        <div className="Preferences__title--header">
          {i18n('icu:Preferences__button--backups')}
        </div>
      </div>

      <div className="Preferences--backups-summary__container">
        {getBackupsSubscriptionSummary({
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
          {cloudBackupStatus.mediaSize != null ||
            cloudBackupStatus.protoSize != null}
          <div className="Preferences--backup-details__row">
            <label>
              {i18n('icu:Preferences--backup-size__label')}{' '}
              <div className="Preferences--backup-details__value">
                {formatFileSize(
                  (cloudBackupStatus.mediaSize ?? 0) +
                    (cloudBackupStatus.protoSize ?? 0)
                )}
              </div>
            </label>
          </div>
        </SettingsRow>
      ) : null}
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
export function getBackupsSubscriptionSummary({
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
