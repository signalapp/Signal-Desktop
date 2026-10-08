// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import { memo } from 'react';
import classNames from 'classnames';

import { ListTile } from '../ListTile.dom.tsx';

export enum Icon {
  Group = 'group',
  Username = 'username',
  PhoneNumber = 'phone-number',
}

const ICONS: Record<Icon, string> = {
  [Icon.Group]: 'ComposeStepButton__icon--group',
  [Icon.Username]: 'ComposeStepButton__icon--username',
  [Icon.PhoneNumber]: 'ComposeStepButton__icon--phone-number',
};

type PropsType = {
  icon: Icon;
  title: string;
  onClick: () => void;
};

export const ComposeStepButton: FunctionComponent<PropsType> = memo(
  function ComposeStepButton({ icon, onClick, title }) {
    return (
      <ListTile
        testId={`ComposeStepButton--${icon}`}
        leading={
          <i className={classNames('ComposeStepButton__icon', ICONS[icon])} />
        }
        title={title}
        onClick={onClick}
      />
    );
  }
);
