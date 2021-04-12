// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ComponentProps, useState } from 'react';
import { times } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { sleep } from '../../../util/sleep';
import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { AddGroupMembersModal } from './AddGroupMembersModal';
import { RequestState } from './util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/AddGroupMembersModal',
  module
);

const allCandidateContacts = times(50, () => getDefaultConversation());

type PropsType = ComponentProps<typeof AddGroupMembersModal>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  candidateContacts: allCandidateContacts,
  clearRequestError: action('clearRequestError'),
  conversationIdsAlreadyInGroup: new Set(),
  groupTitle: 'Tahoe Trip',
  i18n,
  onClose: action('onClose'),
  makeRequest: async (conversationIds: ReadonlyArray<string>) => {
    action('onMakeRequest')(conversationIds);
  },
  requestState: RequestState.Inactive,
  ...overrideProps,
});

story.add('Default', () => <AddGroupMembersModal {...createProps()} />);

story.add('Only 3 contacts', () => (
  <AddGroupMembersModal
    {...createProps({
      candidateContacts: allCandidateContacts.slice(0, 3),
    })}
  />
));

story.add('No candidate contacts', () => (
  <AddGroupMembersModal
    {...createProps({
      candidateContacts: [],
    })}
  />
));

story.add('Everyone already added', () => (
  <AddGroupMembersModal
    {...createProps({
      conversationIdsAlreadyInGroup: new Set(
        allCandidateContacts.map(contact => contact.id)
      ),
    })}
  />
));

story.add('Request fails after 1 second', () => {
  const Wrapper = () => {
    const [requestState, setRequestState] = useState(RequestState.Inactive);

    return (
      <AddGroupMembersModal
        {...createProps({
          clearRequestError: () => {
            setRequestState(RequestState.Inactive);
          },
          makeRequest: async () => {
            setRequestState(RequestState.Active);
            await sleep(1000);
            setRequestState(RequestState.InactiveWithError);
          },
          requestState,
        })}
      />
    );
  };

  return <Wrapper />;
});
