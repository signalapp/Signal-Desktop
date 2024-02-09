// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

import { ListTile } from '../ListTile';

export enum Icon {
  Group = 'group',
  Username = 'username',
  PhoneNumber = 'phone-number',
}

type PropsType = {
  icon: Icon;
  title: string;
  onClick: () => void;
};

export const ComposeStepButton: FunctionComponent<PropsType> = React.memo(
  function ComposeStepButton({ icon, onClick, title }) {
    return (
      <ListTile
        testId={`ComposeStepButton--${icon}`}
        leading={
          <i
            className={`ComposeStepButton__icon ComposeStepButton__icon--${icon}`}
          />
        }
        title={title}
        onClick={onClick}
      />
    );
  }
);
