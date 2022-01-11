// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type PropsActionsType = {
  uploadCrashReports: () => void;
  eraseCrashReports: () => void;
};

type PropsType = {
  i18n: LocalizerType;
  isPending: boolean;
} & PropsActionsType;

export function CrashReportDialog(props: Readonly<PropsType>): JSX.Element {
  const { i18n, isPending, uploadCrashReports, eraseCrashReports } = props;

  const onEraseClick = (event: React.MouseEvent) => {
    event.preventDefault();

    eraseCrashReports();
  };

  const onSubmitClick = (event: React.MouseEvent) => {
    event.preventDefault();

    uploadCrashReports();
  };

  return (
    <Modal
      moduleClassName="module-Modal--important"
      i18n={i18n}
      title={i18n('CrashReportDialog__title')}
      hasXButton
      onClose={eraseCrashReports}
    >
      <section>{i18n('CrashReportDialog__body')}</section>
      <Modal.ButtonFooter>
        <Button
          disabled={isPending}
          onClick={onEraseClick}
          variant={ButtonVariant.Secondary}
        >
          {i18n('CrashReportDialog__erase')}
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
            i18n('CrashReportDialog__submit')
          )}
        </Button>
      </Modal.ButtonFooter>
    </Modal>
  );
}
