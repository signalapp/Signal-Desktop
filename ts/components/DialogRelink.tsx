// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../types/Util';

import { LeftPaneDialog } from './LeftPaneDialog';

export type PropsType = {
  i18n: LocalizerType;
  isRegistrationDone: boolean;
  relinkDevice: () => void;
};

export const DialogRelink = ({
  i18n,
  isRegistrationDone,
  relinkDevice,
}: PropsType): JSX.Element | null => {
  if (isRegistrationDone) {
    return null;
  }

  return (
    <LeftPaneDialog
      type="warning"
      icon="relink"
      clickLabel={i18n('unlinkedWarning')}
      onClick={relinkDevice}
      title={i18n('unlinked')}
      hasAction
    />
  );
};
