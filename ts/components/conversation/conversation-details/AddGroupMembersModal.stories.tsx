// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { useState } from 'react';
import { times } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { sleep } from '../../../util/sleep';
import { makeLookup } from '../../../util/makeLookup';
import { deconstructLookup } from '../../../util/deconstructLookup';
import { setupI18n } from '../../../util/setupI18n';
import type { ConversationType } from '../../../state/ducks/conversations';
import enMessages from '../../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { AddGroupMembersModal } from './AddGroupMembersModal';
import { ChooseGroupMembersModal } from './AddGroupMembersModal/ChooseGroupMembersModal';
import { ConfirmAdditionsModal } from './AddGroupMembersModal/ConfirmAdditionsModal';
import { RequestState } from './util';
import { ThemeType } from '../../../types/Util';
import { makeFakeLookupConversationWithoutUuid } from '../../../test-both/helpers/fakeLookupConversationWithoutUuid';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/AddGroupMembersModal',
  module
);

const allCandidateContacts = times(50, () => getDefaultConversation());
let allCandidateContactsLookup = makeLookup(allCandidateContacts, 'id');

const lookupConversationWithoutUuid = makeFakeLookupConversationWithoutUuid(
  convo => {
    allCandidateContacts.push(convo);
    allCandidateContactsLookup = makeLookup(allCandidateContacts, 'id');
  }
);

type PropsType = ComponentProps<typeof AddGroupMembersModal>;

const createProps = (
  overrideProps: Partial<PropsType> = {},
  candidateContacts: Array<ConversationType> = []
): PropsType => ({
  clearRequestError: action('clearRequestError'),
  conversationIdsAlreadyInGroup: new Set(),
  groupTitle: 'Tahoe Trip',
  i18n,
  onClose: action('onClose'),
  makeRequest: async (conversationIds: ReadonlyArray<string>) => {
    action('onMakeRequest')(conversationIds);
  },
  requestState: RequestState.Inactive,
  renderChooseGroupMembersModal: props => {
    const { selectedConversationIds } = props;
    return (
      <ChooseGroupMembersModal
        {...props}
        candidateContacts={candidateContacts}
        selectedContacts={deconstructLookup(
          allCandidateContactsLookup,
          selectedConversationIds
        )}
        regionCode="US"
        getPreferredBadge={() => undefined}
        theme={ThemeType.light}
        i18n={i18n}
        lookupConversationWithoutUuid={lookupConversationWithoutUuid}
        showUserNotFoundModal={action('showUserNotFoundModal')}
      />
    );
  },
  renderConfirmAdditionsModal: props => {
    const { selectedConversationIds } = props;
    return (
      <ConfirmAdditionsModal
        {...props}
        i18n={i18n}
        selectedContacts={deconstructLookup(
          allCandidateContactsLookup,
          selectedConversationIds
        )}
      />
    );
  },
  ...overrideProps,
});

story.add('Default', () => <AddGroupMembersModal {...createProps()} />);

story.add('Only 3 contacts', () => (
  <AddGroupMembersModal
    {...createProps({}, allCandidateContacts.slice(0, 3))}
  />
));

story.add('No candidate contacts', () => (
  <AddGroupMembersModal {...createProps({}, [])} />
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
