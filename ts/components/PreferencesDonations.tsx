// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { groupBy, sortBy } from 'lodash';

import type { MutableRefObject, ReactNode } from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';
import { getDateTimeFormatter } from '../util/formatTimestamp';

import type { LocalizerType, ThemeType } from '../types/Util';
import { PreferencesContent } from './Preferences';
import { SettingsPage } from '../types/Nav';
import { PreferencesDonateFlow } from './PreferencesDonateFlow';
import type {
  DonationWorkflow,
  DonationReceipt,
  OneTimeDonationHumanAmounts,
  DonationErrorType,
} from '../types/Donations';
import {
  donationErrorTypeSchema,
  donationStateSchema,
} from '../types/Donations';
import type { AvatarColorType } from '../types/Colors';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import { createLogger } from '../logging/log';
import { toLogFormat } from '../types/errors';
import { I18n } from './I18n';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { DonationPrivacyInformationModal } from './DonationPrivacyInformationModal';
import type { SubmitDonationType } from '../state/ducks/donations';
import {
  getHumanDonationAmount,
  toHumanCurrencyString,
} from '../util/currency';
import { Avatar, AvatarSize } from './Avatar';
import type { BadgeType } from '../badges/types';
import { DonationInterruptedModal } from './DonationInterruptedModal';
import { DonationErrorModal } from './DonationErrorModal';
import { DonationVerificationModal } from './DonationVerificationModal';
import { DonationProgressModal } from './DonationProgressModal';
import { DonationStillProcessingModal } from './DonationStillProcessingModal';
import { DonationThanksModal } from './DonationThanksModal';
import type {
  ConversationType,
  ProfileDataType,
} from '../state/ducks/conversations';
import type { AvatarUpdateOptionsType } from '../types/Avatar';
import { drop } from '../util/drop';
import { DonationsOfflineTooltip } from './conversation/DonationsOfflineTooltip';
import { getInProgressDonation } from '../util/donations';

const log = createLogger('PreferencesDonations');

type PropsExternalType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

export type PropsDataType = {
  i18n: LocalizerType;
  initialCurrency: string;
  isOnline: boolean;
  page: SettingsPage;
  didResumeWorkflowAtStartup: boolean;
  lastError: DonationErrorType | undefined;
  workflow: DonationWorkflow | undefined;
  badge: BadgeType | undefined;
  color: AvatarColorType | undefined;
  firstName: string | undefined;
  profileAvatarUrl?: string;
  donationAmountsConfig: OneTimeDonationHumanAmounts | undefined;
  validCurrencies: ReadonlyArray<string>;
  donationReceipts: ReadonlyArray<DonationReceipt>;
  theme: ThemeType;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;
  showToast: (toast: AnyToast) => void;
  donationBadge: BadgeType | undefined;
  fetchBadgeData: () => Promise<BadgeType | undefined>;
  me: ConversationType;
  myProfileChanged: (
    profileData: ProfileDataType,
    avatarUpdateOptions: AvatarUpdateOptionsType
  ) => void;
};

type PropsActionType = {
  applyDonationBadge: (args: {
    badge: BadgeType | undefined;
    applyBadge: boolean;
    onComplete: (error?: Error) => void;
  }) => void;
  clearWorkflow: () => void;
  resumeWorkflow: () => void;
  setPage: (page: SettingsPage) => void;
  showToast: (toast: AnyToast) => void;
  submitDonation: (payload: SubmitDonationType) => void;
  updateLastError: (error: DonationErrorType | undefined) => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

type DonationPage =
  | SettingsPage.Donations
  | SettingsPage.DonationsDonateFlow
  | SettingsPage.DonationsReceiptList;

type PreferencesHomeProps = Pick<
  PropsType,
  | 'contentsRef'
  | 'i18n'
  | 'setPage'
  | 'isOnline'
  | 'donationReceipts'
  | 'workflow'
> & {
  navigateToPage: (newPage: SettingsPage) => void;
  renderDonationHero: () => JSX.Element;
};

function isDonationPage(page: SettingsPage): page is DonationPage {
  return (
    page === SettingsPage.Donations ||
    page === SettingsPage.DonationsDonateFlow ||
    page === SettingsPage.DonationsReceiptList
  );
}

type DonationHeroProps = Pick<
  PropsDataType,
  'badge' | 'color' | 'firstName' | 'i18n' | 'profileAvatarUrl' | 'theme'
> & {
  showPrivacyModal: () => void;
};

function DonationHero({
  badge,
  color,
  firstName,
  i18n,
  profileAvatarUrl,
  theme,
  showPrivacyModal,
}: DonationHeroProps): JSX.Element {
  const privacyReadMoreLink = useCallback(
    (parts: ReactNode): JSX.Element => {
      return (
        <button
          type="button"
          className="PreferencesDonations__description__read-more"
          onClick={showPrivacyModal}
        >
          {parts}
        </button>
      );
    },
    [showPrivacyModal]
  );

  return (
    <>
      <div className="PreferencesDonations__avatar">
        <Avatar
          avatarUrl={profileAvatarUrl}
          badge={badge}
          color={color}
          conversationType="direct"
          title={firstName ?? ''}
          i18n={i18n}
          sharedGroupNames={[]}
          size={AvatarSize.SEVENTY_TWO}
          theme={theme}
        />
      </div>
      <div className="PreferencesDonations__title">
        {i18n('icu:PreferencesDonations__title')}
      </div>
      <div className="PreferencesDonations__description">
        <I18n
          components={{
            readMoreLink: privacyReadMoreLink,
          }}
          i18n={i18n}
          id="icu:PreferencesDonations__description"
        />
      </div>
    </>
  );
}

function DonationsHome({
  i18n,
  renderDonationHero,
  navigateToPage,
  setPage,
  isOnline,
  donationReceipts,
  workflow,
}: PreferencesHomeProps): JSX.Element {
  const [isInProgressModalVisible, setIsInProgressVisible] = useState(false);

  const inProgressDonationAmount = useMemo<string | undefined>(() => {
    const inProgressDonation = getInProgressDonation(workflow);
    return inProgressDonation
      ? toHumanCurrencyString(inProgressDonation)
      : undefined;
  }, [workflow]);

  const handleDonateButtonClicked = useCallback(() => {
    if (inProgressDonationAmount) {
      setIsInProgressVisible(true);
    } else {
      setPage(SettingsPage.DonationsDonateFlow);
    }
  }, [inProgressDonationAmount, setPage]);

  const handleInProgressDonationClicked = useCallback(() => {
    setIsInProgressVisible(true);
  }, []);

  const hasReceipts = donationReceipts.length > 0;

  const donateButton = (
    <Button
      className="PreferencesDonations__PrimaryButton PreferencesDonations__donate-button"
      disabled={!isOnline}
      variant={isOnline ? ButtonVariant.Primary : ButtonVariant.Secondary}
      size={ButtonSize.Medium}
      onClick={handleDonateButtonClicked}
    >
      {i18n('icu:PreferencesDonations__donate-button')}
    </Button>
  );

  return (
    <div className="PreferencesDonations">
      {isInProgressModalVisible && (
        <DonationStillProcessingModal
          i18n={i18n}
          onClose={() => setIsInProgressVisible(false)}
        />
      )}

      {renderDonationHero()}

      {isOnline ? (
        donateButton
      ) : (
        <DonationsOfflineTooltip i18n={i18n}>
          {donateButton}
        </DonationsOfflineTooltip>
      )}

      <hr className="PreferencesDonations__separator" />

      {(hasReceipts || inProgressDonationAmount) && (
        <div className="PreferencesDonations__section-header PreferencesDonations__section-header--my-support">
          {i18n('icu:PreferencesDonations__my-support')}
        </div>
      )}

      {inProgressDonationAmount && (
        <ListBox className="PreferencesDonations__badge-list">
          <ListBoxItem
            className="PreferencesDonations__badge"
            onAction={handleInProgressDonationClicked}
          >
            <div className="PreferencesDonations__badge-icon PreferencesDonations__badge-icon--one-time" />
            <div className="PreferencesDonations__badge-info">
              <div className="PreferencesDonations__badge-label">
                {i18n('icu:PreferencesDonations__badge-label-one-time', {
                  formattedCurrencyAmount: inProgressDonationAmount,
                })}
              </div>
              <div className="PreferencesDonations__badge-processing-info">
                {i18n('icu:PreferencesDonations__badge-processing-donation')}
              </div>
            </div>
          </ListBoxItem>
        </ListBox>
      )}

      <ListBox className="PreferencesDonations__list">
        {hasReceipts && (
          <ListBoxItem
            className="PreferencesDonations__list-item"
            onAction={() => {
              navigateToPage(SettingsPage.DonationsReceiptList);
            }}
          >
            <span className="PreferencesDonations__list-item__icon PreferencesDonations__list-item__icon--receipts" />
            <span className="PreferencesDonations__list-item__text">
              {i18n('icu:PreferencesDonations__receipts')}
            </span>
            <span className="PreferencesDonations__list-item__chevron" />
          </ListBoxItem>
        )}
        <ListBoxItem
          className="PreferencesDonations__list-item"
          onAction={() => {
            openLinkInWebBrowser(
              'https://support.signal.org/hc/articles/360031949872-Donor-FAQs'
            );
          }}
        >
          <span className="PreferencesDonations__list-item__icon PreferencesDonations__list-item__icon--faqs" />
          <span className="PreferencesDonations__list-item__text">
            {i18n('icu:PreferencesDonations__faqs')}
          </span>
          <span className="PreferencesDonations__list-item__open" />
        </ListBoxItem>
      </ListBox>

      <div className="PreferencesDonations__mobile-info">
        {i18n('icu:PreferencesDonations__mobile-info')}
      </div>
    </div>
  );
}

function PreferencesReceiptList({
  i18n,
  donationReceipts,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  showToast,
}: {
  i18n: LocalizerType;
  donationReceipts: ReadonlyArray<DonationReceipt>;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;
  showToast: (toast: AnyToast) => void;
}): JSX.Element {
  const [selectedReceipt, setSelectedReceipt] =
    useState<DonationReceipt | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const hasReceipts = useMemo(
    () => donationReceipts.length > 0,
    [donationReceipts]
  );

  const receiptsByYear = useMemo(() => {
    const sortedReceipts = sortBy(
      donationReceipts,
      receipt => -receipt.timestamp
    );
    return groupBy(sortedReceipts, receipt =>
      new Date(receipt.timestamp).getFullYear()
    );
  }, [donationReceipts]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!selectedReceipt) {
      return;
    }

    setIsDownloading(true);
    try {
      const blob = await generateDonationReceiptBlob(selectedReceipt, i18n);
      const buffer = await blob.arrayBuffer();

      const result = await saveAttachmentToDisk({
        name: `Signal_Receipt_${new Date(selectedReceipt.timestamp).toISOString().split('T')[0]}.png`,
        data: new Uint8Array(buffer),
      });

      if (result) {
        setSelectedReceipt(null);
        showToast({
          toastType: ToastType.ReceiptSaved,
          parameters: { fullPath: result.fullPath },
        });
      }
    } catch (error) {
      log.error('Failed to generate receipt: ', toLogFormat(error));
      showToast({
        toastType: ToastType.ReceiptSaveFailed,
      });
    } finally {
      setIsDownloading(false);
    }
  }, [
    selectedReceipt,
    generateDonationReceiptBlob,
    i18n,
    saveAttachmentToDisk,
    showToast,
  ]);

  const dateFormatter = getDateTimeFormatter({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="PreferencesDonations PreferencesDonations--receiptList">
      {hasReceipts ? (
        <>
          <div className="PreferencesDonations--receiptList__info">
            <div className="PreferencesDonations--receiptList__info__text">
              {i18n('icu:PreferencesDonations--receiptList__info')}
            </div>
          </div>

          {Object.entries(receiptsByYear).map(([year, receipts]) => (
            <div
              key={year}
              className="PreferencesDonations--receiptList-yearContainer"
            >
              <div className="PreferencesDonations--receiptList__year-header">
                {year}
              </div>
              <div className="PreferencesDonations--receiptList__list">
                {receipts.map(receipt => (
                  <button
                    aria-label={i18n(
                      'icu:PreferencesDonations__receipt-details-button-aria'
                    )}
                    key={receipt.id}
                    className="PreferencesDonations--receiptList__receipt-item"
                    onClick={() => setSelectedReceipt(receipt)}
                    type="button"
                  >
                    <div className="PreferencesDonations--receiptList__receipt-item__icon" />
                    <div className="PreferencesDonations--receiptList__receipt-item__details">
                      <div className="PreferencesDonations--receiptList__receipt-item__date">
                        {dateFormatter.format(new Date(receipt.timestamp))}
                      </div>
                      <div className="PreferencesDonations--receiptList__receipt-item__type">
                        {i18n('icu:DonationReceipt__type-value--one-time')}
                      </div>
                    </div>
                    <div className="PreferencesDonations--receiptList__receipt-item__amount">
                      {toHumanCurrencyString({
                        amount: getHumanDonationAmount(receipt),
                        currency: receipt.currencyType,
                      })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="PreferencesDonations--receiptList__empty-state">
          <div className="PreferencesDonations--receiptList__empty-state__title">
            {i18n('icu:PreferencesDonations--receiptList__empty-title')}
          </div>
          <div className="PreferencesDonations--receiptList__empty-state__description">
            {i18n('icu:PreferencesDonations--receiptList__info')}
          </div>
        </div>
      )}

      {selectedReceipt && (
        <Modal
          i18n={i18n}
          modalName="ReceiptDetailsModal"
          moduleClassName="PreferencesDonations__ReceiptModal"
          hasXButton
          padded={false}
          onClose={() => setSelectedReceipt(null)}
          modalFooter={
            <Button
              variant={ButtonVariant.Primary}
              size={ButtonSize.Small}
              onClick={handleDownloadReceipt}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Spinner size="24px" svgSize="small" />
              ) : (
                i18n('icu:PreferencesDonations__ReceiptModal--download')
              )}
            </Button>
          }
        >
          <div className="PreferencesDonations__ReceiptModal__content">
            <div className="PreferencesDonations__ReceiptModal__logo-container">
              <div className="PreferencesDonations__ReceiptModal__logo" />
            </div>
            <div className="PreferencesDonations__ReceiptModal__amount">
              {toHumanCurrencyString({
                amount: getHumanDonationAmount(selectedReceipt),
                currency: selectedReceipt.currencyType,
              })}
            </div>
            <hr className="PreferencesDonations__ReceiptModal__separator" />
            <div className="PreferencesDonations__ReceiptModal__details">
              <div className="PreferencesDonations__ReceiptModal__detail-item">
                <div className="PreferencesDonations__ReceiptModal__detail-label">
                  {i18n('icu:PreferencesDonations__ReceiptModal--type-label')}
                </div>
                <div className="PreferencesDonations__ReceiptModal__detail-value">
                  {i18n('icu:DonationReceipt__type-value--one-time')}
                </div>
              </div>
              <div className="PreferencesDonations__ReceiptModal__detail-item">
                <div className="PreferencesDonations__ReceiptModal__detail-label">
                  {i18n(
                    'icu:PreferencesDonations__ReceiptModal--date-paid-label'
                  )}
                </div>
                <div className="PreferencesDonations__ReceiptModal__detail-value">
                  {dateFormatter.format(new Date(selectedReceipt.timestamp))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function PreferencesDonations({
  contentsRef,
  i18n,
  initialCurrency,
  isOnline,
  page,
  workflow,
  didResumeWorkflowAtStartup,
  lastError,
  applyDonationBadge,
  clearWorkflow,
  resumeWorkflow,
  setPage,
  submitDonation,
  badge,
  color,
  firstName,
  profileAvatarUrl,
  donationAmountsConfig,
  validCurrencies,
  donationReceipts,
  theme,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  showToast,
  updateLastError,
  donationBadge,
  fetchBadgeData,
}: PropsType): JSX.Element | null {
  const [hasProcessingExpired, setHasProcessingExpired] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);

  // Fetch badge data when we're about to show the badge modal
  useEffect(() => {
    if (
      workflow?.type === donationStateSchema.Enum.DONE &&
      page === SettingsPage.Donations &&
      !donationBadge
    ) {
      drop(fetchBadgeData());
    }
  }, [workflow, page, donationBadge, fetchBadgeData]);

  const navigateToPage = useCallback(
    (newPage: SettingsPage) => {
      setPage(newPage);
    },
    [setPage]
  );

  useEffect(() => {
    if (lastError) {
      setIsSubmitted(false);
    }

    if (
      workflow?.type === donationStateSchema.Enum.INTENT_CONFIRMED ||
      workflow?.type === donationStateSchema.Enum.RECEIPT ||
      workflow?.type === donationStateSchema.Enum.DONE
    ) {
      setIsSubmitted(false);
    }
  }, [lastError, workflow, setIsSubmitted]);

  const renderDonationHero = useCallback(
    () => (
      <DonationHero
        badge={badge}
        color={color}
        firstName={firstName}
        i18n={i18n}
        profileAvatarUrl={profileAvatarUrl}
        theme={theme}
        showPrivacyModal={() => setIsPrivacyModalVisible(true)}
      />
    ),
    [badge, color, firstName, i18n, profileAvatarUrl, theme]
  );

  if (!isDonationPage(page)) {
    return null;
  }

  let dialog: ReactNode | undefined;
  if (lastError) {
    dialog = (
      <DonationErrorModal
        errorType={lastError}
        i18n={i18n}
        onClose={() => {
          setIsSubmitted(false);
          if (
            workflow?.type === 'DONE' &&
            lastError === donationErrorTypeSchema.Enum.BadgeApplicationFailed
          ) {
            clearWorkflow();
          }
          updateLastError(undefined);
        }}
      />
    );
  } else if (
    didResumeWorkflowAtStartup &&
    workflow?.type === donationStateSchema.Enum.INTENT_METHOD
  ) {
    dialog = (
      <DonationInterruptedModal
        i18n={i18n}
        onCancelDonation={() => {
          clearWorkflow();
          setPage(SettingsPage.Donations);
          showToast({ toastType: ToastType.DonationCanceled });
        }}
        onRetryDonation={() => {
          resumeWorkflow();
        }}
      />
    );
  } else if (workflow?.type === donationStateSchema.Enum.INTENT_REDIRECT) {
    dialog = (
      <DonationVerificationModal
        i18n={i18n}
        onCancelDonation={() => {
          clearWorkflow();
          setPage(SettingsPage.Donations);
          showToast({ toastType: ToastType.DonationCanceled });
        }}
        onOpenBrowser={() => {
          openLinkInWebBrowser(workflow.redirectTarget);
        }}
        onTimedOut={() => {
          clearWorkflow();
          updateLastError(donationErrorTypeSchema.Enum.TimedOut);
          setPage(SettingsPage.Donations);
        }}
      />
    );
  } else if (workflow?.type === donationStateSchema.Enum.DONE) {
    dialog = (
      <DonationThanksModal
        i18n={i18n}
        badge={donationBadge}
        applyDonationBadge={applyDonationBadge}
        onClose={(error?: Error) => {
          if (error) {
            log.error('Badge application failed:', error.message);
            updateLastError(
              donationErrorTypeSchema.Enum.BadgeApplicationFailed
            );
          } else {
            clearWorkflow();
          }
        }}
      />
    );
  } else if (
    page === SettingsPage.DonationsDonateFlow &&
    (isSubmitted ||
      workflow?.type === donationStateSchema.Enum.INTENT_CONFIRMED ||
      workflow?.type === donationStateSchema.Enum.RECEIPT)
  ) {
    // We can't transition away from the payment screen until that payment information
    // has been accepted. Even if it takes more than 30 seconds.
    if (
      hasProcessingExpired &&
      (workflow?.type === donationStateSchema.Enum.INTENT_CONFIRMED ||
        workflow?.type === donationStateSchema.Enum.RECEIPT)
    ) {
      dialog = (
        <DonationStillProcessingModal
          i18n={i18n}
          onClose={() => {
            setPage(SettingsPage.Donations);
            // We need to delay until we've transitioned away from this page, or we'll
            // go back to showing the spinner.
            setTimeout(() => setHasProcessingExpired(false), 500);
          }}
        />
      );
    } else {
      dialog = (
        <DonationProgressModal
          i18n={i18n}
          onWaitedTooLong={() => setHasProcessingExpired(true)}
        />
      );
    }
  }

  const privacyModal = isPrivacyModalVisible ? (
    <DonationPrivacyInformationModal
      i18n={i18n}
      onClose={() => setIsPrivacyModalVisible(false)}
    />
  ) : null;

  let content;
  if (page === SettingsPage.DonationsDonateFlow) {
    // DonateFlow has to control Back button to switch between CC form and Amount picker
    return (
      <>
        {dialog}
        {privacyModal}
        <PreferencesDonateFlow
          contentsRef={contentsRef}
          i18n={i18n}
          isOnline={isOnline}
          initialCurrency={initialCurrency}
          donationAmountsConfig={donationAmountsConfig}
          lastError={lastError}
          validCurrencies={validCurrencies}
          workflow={workflow}
          clearWorkflow={clearWorkflow}
          renderDonationHero={renderDonationHero}
          submitDonation={details => {
            setIsSubmitted(true);
            submitDonation(details);
          }}
          showPrivacyModal={() => setIsPrivacyModalVisible(true)}
          onBack={() => setPage(SettingsPage.Donations)}
        />
      </>
    );
  }
  if (page === SettingsPage.Donations) {
    content = (
      <DonationsHome
        contentsRef={contentsRef}
        i18n={i18n}
        isOnline={isOnline}
        navigateToPage={navigateToPage}
        donationReceipts={donationReceipts}
        renderDonationHero={renderDonationHero}
        setPage={setPage}
        workflow={workflow}
      />
    );
  } else if (page === SettingsPage.DonationsReceiptList) {
    content = (
      <PreferencesReceiptList
        i18n={i18n}
        donationReceipts={donationReceipts}
        saveAttachmentToDisk={saveAttachmentToDisk}
        generateDonationReceiptBlob={generateDonationReceiptBlob}
        showToast={showToast}
      />
    );
  }

  let title: string | undefined;
  let backButton: JSX.Element | undefined;
  if (page === SettingsPage.Donations) {
    title = i18n('icu:Preferences__DonateTitle');
  } else if (page === SettingsPage.DonationsReceiptList) {
    title = i18n('icu:PreferencesDonations__receipts');
    backButton = (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={() => setPage(SettingsPage.Donations)}
        type="button"
      />
    );
  }

  return (
    <>
      {dialog}
      {privacyModal}
      <PreferencesContent
        backButton={backButton}
        contents={content}
        contentsRef={contentsRef}
        title={title}
      />
    </>
  );
}
