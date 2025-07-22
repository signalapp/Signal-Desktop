// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { SpinnerV2 } from './SpinnerV2';
import { SECOND } from '../util/durations';

export type PropsType = {
  i18n: LocalizerType;
  onWaitedTooLong: () => void;
};

export function DonationProgressModal(props: PropsType): JSX.Element {
  const { i18n, onWaitedTooLong } = props;

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
      timeout = undefined;
      onWaitedTooLong();
    }, SECOND * 30);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [onWaitedTooLong]);

  return (
    <Modal
      i18n={i18n}
      moduleClassName="DonationProgressModal"
      modalName="DonationProgressModal"
      noMouseClose
      onClose={() => undefined}
    >
      <SpinnerV2 size={58} strokeWidth={8} />
      <div className="DonationProgressModal__text">
        {i18n('icu:Donations__Processing')}
      </div>
    </Modal>
  );
}
