// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type {
  CallingRaisedHandsListButtonPropsType,
  PropsType,
} from './CallingRaisedHandsList';
import {
  CallingRaisedHandsList,
  CallingRaisedHandsListButton,
} from './CallingRaisedHandsList';
import type { ConversationType } from '../state/ducks/conversations';
import { AvatarColors } from '../types/Colors';
import { getDefaultConversationWithServiceId } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const MAX_HANDS = 20;
const LOCAL_DEMUX_ID = 1;
const NAMES = [
  'Tom Ato',
  'Ann Chovy',
  'Longanisa Lisa Duchess of Summer Pumpkin',
  'Rick Astley',
  'Ash Ketchup',
  'Kiki',
];

const i18n = setupI18n('en', enMessages);

const conversation = getDefaultConversationWithServiceId({
  id: '3051234567',
  avatarUrl: undefined,
  color: AvatarColors[0],
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
});

const conversationsByDemuxId = new Map<number, ConversationType>(
  times(MAX_HANDS).map(index => [
    LOCAL_DEMUX_ID + index + 1,
    getDefaultConversationWithServiceId({
      title: NAMES[index] || `Participant ${index + 1}`,
    }),
  ])
);
conversationsByDemuxId.set(LOCAL_DEMUX_ID, conversation);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  onClose: action('on-close'),
  onLowerMyHand: action('on-lower-my-hand'),
  localDemuxId: LOCAL_DEMUX_ID,
  conversationsByDemuxId,
  localHandRaised: overrideProps.localHandRaised || false,
  raisedHands: overrideProps.raisedHands || new Set<number>(),
});

const createPropsForButton = (
  overrideProps: Partial<CallingRaisedHandsListButtonPropsType> = {}
): CallingRaisedHandsListButtonPropsType => ({
  i18n,
  syncedLocalHandRaised: overrideProps.syncedLocalHandRaised || false,
  raisedHandsCount: overrideProps.raisedHandsCount || 1,
  onClick: action('on-click'),
});

export default {
  title: 'Components/CallingRaisedHandsList',
} satisfies Meta<PropsType>;

export function Me(): JSX.Element {
  const props = createProps({
    localHandRaised: true,
    raisedHands: new Set([LOCAL_DEMUX_ID]),
  });
  return <CallingRaisedHandsList {...props} />;
}

export function MeOnAnotherDevice(): JSX.Element {
  const props = createProps({
    raisedHands: new Set([LOCAL_DEMUX_ID]),
  });
  return <CallingRaisedHandsList {...props} />;
}

export function MeAndOne(): JSX.Element {
  const props = createProps({
    localHandRaised: true,
    raisedHands: new Set([LOCAL_DEMUX_ID, LOCAL_DEMUX_ID + 1]),
  });
  return <CallingRaisedHandsList {...props} />;
}

export function One(): JSX.Element {
  const props = createProps({ raisedHands: new Set([LOCAL_DEMUX_ID + 1]) });
  return <CallingRaisedHandsList {...props} />;
}

export function Many(): JSX.Element {
  const props = createProps({
    raisedHands: new Set([...conversationsByDemuxId.keys()]),
  });
  return <CallingRaisedHandsList {...props} />;
}

export function Button(): JSX.Element {
  const props = createPropsForButton();
  return <CallingRaisedHandsListButton {...props} />;
}

export function ButtonChanging(): JSX.Element {
  const initialProps = createPropsForButton();

  const [props, setProps] = React.useState(initialProps);
  React.useEffect(() => {
    const interval = setInterval(() => {
      const raisedHandsCount = Math.floor(4 * Math.random());
      setProps(prevProps => ({
        ...prevProps,
        raisedHandsCount,
        syncedLocalHandRaised: Boolean(raisedHandsCount && Math.random() > 0.5),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return <CallingRaisedHandsListButton {...props} />;
}
