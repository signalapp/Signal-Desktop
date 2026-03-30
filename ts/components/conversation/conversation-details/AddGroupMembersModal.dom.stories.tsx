// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { useState } from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { sleep } from '../../../util/sleep.std.ts';
import { makeLookup } from '../../../util/makeLookup.std.ts';
import { deconstructLookup } from '../../../util/deconstructLookup.std.ts';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.ts';
import { AddGroupMembersModal } from './AddGroupMembersModal.dom.tsx';
import { ChooseGroupMembersModal } from './AddGroupMembersModal/ChooseGroupMembersModal.dom.tsx';
import { ConfirmAdditionsModal } from './AddGroupMembersModal/ConfirmAdditionsModal.dom.tsx';
import { RequestState } from './util.std.ts';
import { ThemeType } from '../../../types/Util.std.ts';
import { makeFakeLookupConversationWithoutServiceId } from '../../../test-helpers/fakeLookupConversationWithoutServiceId.std.ts';

const { times } = lodash;

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/AddGroupMembersModal',
} satisfies Meta<PropsType>;

const allCandidateContacts = times(50, () => getDefaultConversation());
let allCandidateContactsLookup = makeLookup(allCandidateContacts, 'id');

const lookupConversationWithoutServiceId =
  makeFakeLookupConversationWithoutServiceId(convo => {
    allCandidateContacts.push(convo);
    allCandidateContactsLookup = makeLookup(allCandidateContacts, 'id');
  });

type PropsType = ComponentProps<typeof AddGroupMembersModal>;

const createProps = (
  overrideProps: Partial<PropsType> = {},
  candidateContacts: Array<ConversationType> = allCandidateContacts
): PropsType => ({
  clearRequestError: action('clearRequestError'),
  conversationIdsAlreadyInGroup: new Set(),
  groupTitle: 'Tahoe Trip',
  i18n,
  onClose: action('onClose'),
  makeRequest: async (conversationIds: ReadonlyArray<string>) => {
    action('onMakeRequest')(conversationIds);
  },
  maxGroupSize: 1001,
  maxRecommendedGroupSize: 151,
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
        ourE164={undefined}
        ourUsername={undefined}
        theme={ThemeType.light}
        i18n={i18n}
        lookupConversationWithoutServiceId={lookupConversationWithoutServiceId}
        showUserNotFoundModal={action('showUserNotFoundModal')}
        username={undefined}
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

export function Default(): React.JSX.Element {
  return <AddGroupMembersModal {...createProps()} />;
}

export function Only3Contacts(): React.JSX.Element {
  return (
    <AddGroupMembersModal
      {...createProps({}, allCandidateContacts.slice(0, 3))}
    />
  );
}

export function NoCandidateContacts(): React.JSX.Element {
  return <AddGroupMembersModal {...createProps({}, [])} />;
}

export function EveryoneAlreadyAdded(): React.JSX.Element {
  return (
    <AddGroupMembersModal
      {...createProps({
        conversationIdsAlreadyInGroup: new Set(
          allCandidateContacts.map(contact => contact.id)
        ),
      })}
    />
  );
}

function RequestFailsAfter1SecondWrapper() {
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
}

export function RequestFailsAfter1Second(): React.JSX.Element {
  return <RequestFailsAfter1SecondWrapper />;
}
