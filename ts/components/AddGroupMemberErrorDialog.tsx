// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, ReactNode } from 'react';

import { LocalizerType } from '../types/Util';
import { Alert } from './Alert';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';
import { missingCaseError } from '../util/missingCaseError';

export enum AddGroupMemberErrorDialogMode {
  CantAddContact,
  MaximumGroupSize,
  RecommendedMaximumGroupSize,
}

type PropsDataType =
  | {
      mode: AddGroupMemberErrorDialogMode.CantAddContact;
      contact: {
        name?: string;
        phoneNumber?: string;
        profileName?: string;
        title: string;
      };
    }
  | {
      mode: AddGroupMemberErrorDialogMode.MaximumGroupSize;
      maximumNumberOfContacts: number;
    }
  | {
      mode: AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize;
      recommendedMaximumNumberOfContacts: number;
    };

type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
} & PropsDataType;

export const AddGroupMemberErrorDialog: FunctionComponent<PropsType> = props => {
  const { i18n, onClose } = props;

  let title: string;
  let body: ReactNode;
  switch (props.mode) {
    case AddGroupMemberErrorDialogMode.CantAddContact: {
      const { contact } = props;
      title = i18n('chooseGroupMembers__cant-add-member__title');
      body = (
        <Intl
          i18n={i18n}
          id="chooseGroupMembers__cant-add-member__body"
          components={[
            <ContactName
              key="name"
              name={contact.name}
              profileName={contact.profileName}
              phoneNumber={contact.phoneNumber}
              title={contact.title}
              i18n={i18n}
            />,
          ]}
        />
      );
      break;
    }
    case AddGroupMemberErrorDialogMode.MaximumGroupSize: {
      const { maximumNumberOfContacts } = props;
      title = i18n('chooseGroupMembers__maximum-group-size__title');
      body = i18n('chooseGroupMembers__maximum-group-size__body', [
        maximumNumberOfContacts.toString(),
      ]);
      break;
    }
    case AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize: {
      const { recommendedMaximumNumberOfContacts } = props;
      title = i18n('chooseGroupMembers__maximum-recommended-group-size__title');
      body = i18n('chooseGroupMembers__maximum-recommended-group-size__body', [
        recommendedMaximumNumberOfContacts.toString(),
      ]);
      break;
    }
    default:
      throw missingCaseError(props);
  }

  return <Alert body={body} i18n={i18n} onClose={onClose} title={title} />;
};
