// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactNode } from 'react';

import { missingCaseError } from '../util/missingCaseError.std.js';
import { donationErrorTypeSchema } from '../types/Donations.std.js';

import type { LocalizerType } from '../types/Util.std.js';
import type { DonationErrorType } from '../types/Donations.std.js';
import { Button } from './Button.dom.js';
import { Modal } from './Modal.dom.js';

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
    case donationErrorTypeSchema.Enum.TimedOut: {
      title = i18n('icu:Donations__TimedOut');
      body = i18n('icu:Donations__TimedOut__Description');
      break;
    }
    case donationErrorTypeSchema.Enum.BadgeApplicationFailed: {
      title = i18n('icu:Donations__BadgeApplicationFailed__Title');
      body = i18n('icu:Donations__BadgeApplicationFailed__Description');
      break;
    }

    default:
      throw missingCaseError(props.errorType);
  }

  return (
    <Modal
      hasXButton
      i18n={i18n}
      modalFooter={
        <Button onClick={onClose}>{i18n('icu:Confirmation--confirm')}</Button>
      }
      moduleClassName="DonationErrorModal"
      modalName="DonationErrorModal"
      noMouseClose
      onClose={onClose}
      title={title}
    >
      {body}
    </Modal>
  );
}
