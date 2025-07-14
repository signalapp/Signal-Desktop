// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactNode } from 'react';

import { missingCaseError } from '../util/missingCaseError';
import { donationErrorTypeSchema } from '../types/Donations';

import type { LocalizerType } from '../types/Util';
import type { DonationErrorType } from '../types/Donations';
import { Button } from './Button';
import { Modal } from './Modal';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
  errorType: DonationErrorType;
};

export function DonationErrorModal(props: PropsType): JSX.Element {
  const { i18n, onClose } = props;

  let title: string;
  let body: ReactNode;

  switch (props.errorType) {
    case donationErrorTypeSchema.Enum.DonationProcessingError: {
      title = i18n('icu:Donations__ErrorProcessingDonation');
      body = i18n('icu:Donations__ErrorProcessingDonation__Description');
      break;
    }
    case donationErrorTypeSchema.Enum.Failed3dsValidation: {
      title = i18n('icu:Donations__Failed3dsValidation');
      body = i18n('icu:Donations__Failed3dsValidation__Description');
      break;
    }
    case donationErrorTypeSchema.Enum.GeneralError: {
      title = i18n('icu:Donations__GenericError');
      body = i18n('icu:Donations__GenericError__Description');
      break;
    }
    case donationErrorTypeSchema.Enum.PaymentDeclined: {
      title = i18n('icu:Donations__PaymentMethodDeclined');
      body = i18n('icu:Donations__PaymentMethodDeclined__Description');
      break;
    }

    default:
      throw missingCaseError(props.errorType);
  }

  return (
    <Modal
      i18n={i18n}
      modalFooter={
        <Button onClick={onClose}>{i18n('icu:Confirmation--confirm')}</Button>
      }
      hasXButton
      moduleClassName="DonationErrorModal"
      modalName="DonationErrorModal"
      onClose={onClose}
      title={title}
    >
      {body}
    </Modal>
  );
}
