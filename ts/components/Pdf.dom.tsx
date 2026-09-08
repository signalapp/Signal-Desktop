// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import type { PDFWindowPropsType } from '../windows/pdf/types.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { SignalAccountKeys } from './preferences/SignalAccountKeys.dom.tsx';

export type PDFProps = Readonly<{
  i18n: LocalizerType;
}> &
  PDFWindowPropsType;

export function Pdf(props: PDFProps): JSX.Element {
  const { i18n } = props;

  if (props.view === 'account-keys') {
    return (
      <SignalAccountKeys
        i18n={i18n}
        serviceId={props.serviceId}
        backupKey={props.backupKey}
        saveAccountKeysPDF={undefined}
      />
    );
  }
  throw missingCaseError(props.view);
}
