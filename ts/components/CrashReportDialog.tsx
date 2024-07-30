// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type PropsActionsType = {
  writeCrashReportsToLog: () => void;
  eraseCrashReports: () => void;
};

export type PropsType = {
  i18n: LocalizerType;
  isPending: boolean;
} & PropsActionsType;

export function CrashReportDialog({
  i18n,
  isPending,
  writeCrashReportsToLog,
  eraseCrashReports,
}: Readonly<PropsType>): JSX.Element {
  const onEraseClick = (event: React.MouseEvent) => {
    event.preventDefault();

    eraseCrashReports();
  };

  const onSubmitClick = (event: React.MouseEvent) => {
    event.preventDefault();

    writeCrashReportsToLog();
  };

  const footer = (
    <>
      <Button
        disabled={isPending}
        onClick={onEraseClick}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:CrashReportDialog__erase')}
      </Button>
      <Button
        disabled={isPending}
        onClick={onSubmitClick}
        ref={button => button?.focus()}
        variant={ButtonVariant.Primary}
      >
        {isPending ? (
          <Spinner size="22px" svgSize="small" />
        ) : (
          i18n('icu:CrashReportDialog__submit')
        )}
      </Button>
    </>
  );

  return (
    <Modal
      modalName="CrashReportDialog"
      moduleClassName="module-Modal--important"
      i18n={i18n}
      title={i18n('icu:CrashReportDialog__title')}
      hasXButton
      onClose={eraseCrashReports}
      modalFooter={footer}
    >
      <section>{i18n('icu:CrashReportDialog__body')}</section>
    </Modal>
  );
}
