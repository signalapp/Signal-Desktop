// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import { groupBy, sortBy } from 'lodash';

import type { MutableRefObject, ReactNode } from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';
import { getDateTimeFormatter } from '../util/formatTimestamp';

import type { LocalizerType } from '../types/Util';
import { Page, PreferencesContent } from './Preferences';
import { PreferencesDonateFlow } from './PreferencesDonateFlow';
import type {
  DonationWorkflow,
  DonationReceipt,
  OneTimeDonationHumanAmounts,
} from '../types/Donations';
import type { AvatarColorType } from '../types/Colors';
import type { AvatarDataType } from '../types/Avatar';
import { AvatarPreview } from './AvatarPreview';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import { createLogger } from '../logging/log';
import { toLogFormat } from '../types/errors';
import { I18n } from './I18n';
import type { SubmitDonationType } from '../state/ducks/donations';
import { getHumanDonationAmount } from '../util/currency';

const log = createLogger('PreferencesDonations');

type PropsExternalType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

export type PropsDataType = {
  i18n: LocalizerType;
  isStaging: boolean;
  page: Page;
  workflow: DonationWorkflow | undefined;
  userAvatarData: ReadonlyArray<AvatarDataType>;
  color?: AvatarColorType;
  firstName?: string;
  profileAvatarUrl?: string;
  donationAmountsConfig: OneTimeDonationHumanAmounts | undefined;
  validCurrencies: ReadonlyArray<string>;
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
};

type PropsActionType = {
  clearWorkflow: () => void;
  setPage: (page: Page) => void;
  submitDonation: (payload: SubmitDonationType) => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

type DonationPage =
  | Page.Donations
  | Page.DonationsDonateFlow
  | Page.DonationsReceiptList;

type PreferencesHomeProps = PropsType & {
  navigateToPage: (newPage: Page) => void;
};

function isDonationPage(page: Page): page is DonationPage {
  return (
    page === Page.Donations ||
    page === Page.DonationsDonateFlow ||
    page === Page.DonationsReceiptList
  );
}

function LearnMoreButton(parts: ReactNode): JSX.Element {
  return (
    <button
      type="button"
      className="PreferencesDonations__description__read-more"
      onClick={() => {
        // DESKTOP-8973
      }}
    >
      {parts}
    </button>
  );
}

function DonationsHome({
  i18n,
  userAvatarData,
  color,
  firstName,
  profileAvatarUrl,
  navigateToPage,
  setPage,
  isStaging,
  donationReceipts,
}: PreferencesHomeProps): JSX.Element {
  const avatarData = userAvatarData[0];
  const avatarBuffer = avatarData?.buffer;
  const hasReceipts = donationReceipts.length > 0;

  return (
    <div className="PreferencesDonations">
      <div className="PreferencesDonations__avatar">
        <AvatarPreview
          avatarColor={color}
          avatarUrl={profileAvatarUrl}
          avatarValue={avatarBuffer}
          conversationTitle={firstName || i18n('icu:unknownContact')}
          i18n={i18n}
          style={{
            height: 80,
            width: 80,
          }}
        />
      </div>
      <div className="PreferencesDonations__title">
        {i18n('icu:PreferencesDonations__title')}
      </div>
      <div className="PreferencesDonations__description">
        <I18n
          components={{
            learnMoreLink: LearnMoreButton,
          }}
          i18n={i18n}
          id="icu:PreferencesDonations__description"
        />
      </div>
      {isStaging && (
        <Button
          className="PreferencesDonations__donate-button"
          variant={ButtonVariant.Primary}
          size={ButtonSize.Medium}
          onClick={() => {
            setPage(Page.DonationsDonateFlow);
          }}
        >
          {i18n('icu:PreferencesDonations__donate-button')}
        </Button>
      )}

      <hr className="PreferencesDonations__separator" />

      <ListBox className="PreferencesDonations__list">
        {hasReceipts && (
          <ListBoxItem
            className="PreferencesDonations__list-item"
            onAction={() => {
              navigateToPage(Page.DonationsReceiptList);
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
            // TODO: Handle donation FAQs action
          }}
        >
          <span className="PreferencesDonations__list-item__icon PreferencesDonations__list-item__icon--faqs" />
          <span className="PreferencesDonations__list-item__text">
            {i18n('icu:PreferencesDonations__faqs')}
          </span>
          <span className="PreferencesDonations__list-item__chevron" />
        </ListBoxItem>
      </ListBox>
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
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] =
    useState<DonationReceipt | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const sortedReceipts = sortBy(
    donationReceipts,
    receipt => -receipt.timestamp
  );
  const receiptsByYear = groupBy(sortedReceipts, receipt =>
    new Date(receipt.timestamp).getFullYear()
  );

  const dateFormatter = getDateTimeFormatter({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const preferredSystemLocales =
    window.SignalContext.getPreferredSystemLocales();
  const localeOverride = window.SignalContext.getLocaleOverride();
  const locales =
    localeOverride != null ? [localeOverride] : preferredSystemLocales;

  const getCurrencyFormatter = (currencyType: string) =>
    new Intl.NumberFormat(locales, {
      style: 'currency',
      currency: currencyType,
    });

  const hasReceipts = Object.keys(receiptsByYear).length > 0;

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
        setShowReceiptModal(false);
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
              <ListBox className="PreferencesDonations--receiptList__list">
                {receipts.map(receipt => (
                  <ListBoxItem
                    key={receipt.id}
                    className="PreferencesDonations--receiptList__receipt-item"
                    onAction={() => {
                      setSelectedReceipt(receipt);
                      setShowReceiptModal(true);
                    }}
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
                      {getCurrencyFormatter(receipt.currencyType).format(
                        getHumanDonationAmount(receipt)
                      )}
                    </div>
                  </ListBoxItem>
                ))}
              </ListBox>
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

      {showReceiptModal && selectedReceipt && (
        <Modal
          i18n={i18n}
          modalName="ReceiptDetailsModal"
          moduleClassName="PreferencesDonations__ReceiptModal"
          hasXButton
          title={i18n('icu:PreferencesDonations__ReceiptModal--title')}
          onClose={() => setShowReceiptModal(false)}
          modalFooter={
            <Button
              variant={ButtonVariant.Primary}
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
              {getCurrencyFormatter(selectedReceipt.currencyType).format(
                getHumanDonationAmount(selectedReceipt)
              )}
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
  isStaging,
  page,
  workflow,
  clearWorkflow,
  setPage,
  submitDonation,
  userAvatarData,
  color,
  firstName,
  profileAvatarUrl,
  donationAmountsConfig,
  validCurrencies,
  donationReceipts,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  showToast,
}: PropsType): JSX.Element | null {
  const navigateToPage = useCallback(
    (newPage: Page) => {
      setPage(newPage);
    },
    [setPage]
  );

  if (!isDonationPage(page)) {
    return null;
  }

  let content;
  if (page === Page.DonationsDonateFlow) {
    // DonateFlow has to control Back button to switch between CC form and Amount picker
    return (
      <PreferencesDonateFlow
        contentsRef={contentsRef}
        i18n={i18n}
        donationAmountsConfig={donationAmountsConfig}
        validCurrencies={validCurrencies}
        workflow={workflow}
        clearWorkflow={clearWorkflow}
        submitDonation={submitDonation}
        onBack={() => setPage(Page.Donations)}
      />
    );
  }
  if (page === Page.Donations) {
    content = (
      <DonationsHome
        contentsRef={contentsRef}
        i18n={i18n}
        userAvatarData={userAvatarData}
        color={color}
        firstName={firstName}
        profileAvatarUrl={profileAvatarUrl}
        navigateToPage={navigateToPage}
        donationReceipts={donationReceipts}
        donationAmountsConfig={donationAmountsConfig}
        validCurrencies={validCurrencies}
        saveAttachmentToDisk={saveAttachmentToDisk}
        generateDonationReceiptBlob={generateDonationReceiptBlob}
        showToast={showToast}
        isStaging={isStaging}
        page={page}
        workflow={workflow}
        clearWorkflow={clearWorkflow}
        setPage={setPage}
        submitDonation={submitDonation}
      />
    );
  } else if (page === Page.DonationsReceiptList) {
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
  if (page === Page.Donations) {
    title = i18n('icu:Preferences__DonateTitle');
  } else if (page === Page.DonationsReceiptList) {
    title = i18n('icu:PreferencesDonations__receipts');
    backButton = (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={() => setPage(Page.Donations)}
        type="button"
      />
    );
  }

  return (
    <PreferencesContent
      backButton={backButton}
      contents={content}
      contentsRef={contentsRef}
      title={title}
    />
  );
}
