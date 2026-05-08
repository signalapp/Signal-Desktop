// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { donationErrorTypeSchema } from '../types/Donations.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { DonationErrorType } from '../types/Donations.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
  errorType: DonationErrorType;
}>;

export function DonationErrorModal(props: PropsType): JSX.Element {
  const { i18n } = props;

  let title: string;
  let body: string;

  switch (props.errorType) {
    case donationErrorTypeSchema.enum.Failed3dsValidation: {
      title = i18n('icu:Donations__Failed3dsValidation');
      body = i18n('icu:Donations__Failed3dsValidation__Description');
      break;
    }
    case donationErrorTypeSchema.enum.GeneralError: {
      title = i18n('icu:Donations__GenericError');
      body = i18n('icu:Donations__GenericError__Description');
      break;
    }
    case donationErrorTypeSchema.enum.PaymentDeclined: {
      title = i18n('icu:Donations__PaymentMethodDeclined');
      body = i18n('icu:Donations__PaymentMethodDeclined__Description');
      break;
    }
    case donationErrorTypeSchema.enum.PaypalCanceled: {
      title = i18n('icu:Donations__PaypalCanceled');
      body = i18n('icu:Donations__PaypalCanceled__Description');
      break;
    }
    case donationErrorTypeSchema.enum.PaypalError: {
      title = i18n('icu:Donations__PaypalError');
      body = i18n('icu:Donations__PaypalError__Description');
      break;
    }
    case donationErrorTypeSchema.enum.TimedOut: {
      title = i18n('icu:Donations__TimedOut');
      body = i18n('icu:Donations__TimedOut__Description');
      break;
    }
    case donationErrorTypeSchema.enum.BadgeApplicationFailed: {
      title = i18n('icu:Donations__BadgeApplicationFailed__Title');
      body = i18n('icu:Donations__BadgeApplicationFailed__Description');
      break;
    }
    default:
      throw missingCaseError(props.errorType);
  }

  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={title}
      description={body}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}
