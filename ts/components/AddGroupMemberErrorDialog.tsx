// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Alert } from './Alert';
import { missingCaseError } from '../util/missingCaseError';

export enum AddGroupMemberErrorDialogMode {
  MaximumGroupSize,
  RecommendedMaximumGroupSize,
}

type PropsDataType =
  | {
      mode: AddGroupMemberErrorDialogMode.MaximumGroupSize;
      maximumNumberOfContacts: number;
    }
  | {
      mode: AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize;
      recommendedMaximumNumberOfContacts: number;
    };

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
} & PropsDataType;

export function AddGroupMemberErrorDialog(props: PropsType): JSX.Element {
  const { i18n, onClose } = props;

  let title: string;
  let body: ReactNode;
  switch (props.mode) {
    case AddGroupMemberErrorDialogMode.MaximumGroupSize: {
      const { maximumNumberOfContacts } = props;
      title = i18n('icu:chooseGroupMembers__maximum-group-size__title');
      body = i18n('icu:chooseGroupMembers__maximum-group-size__body', {
        max: maximumNumberOfContacts,
      });
      break;
    }
    case AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize: {
      const { recommendedMaximumNumberOfContacts } = props;
      title = i18n(
        'icu:chooseGroupMembers__maximum-recommended-group-size__title'
      );
      body = i18n(
        'icu:chooseGroupMembers__maximum-recommended-group-size__body',
        {
          max: recommendedMaximumNumberOfContacts,
        }
      );
      break;
    }
    default:
      throw missingCaseError(props);
  }

  return <Alert body={body} i18n={i18n} onClose={onClose} title={title} />;
}
