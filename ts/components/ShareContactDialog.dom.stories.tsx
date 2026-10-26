// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import { useContext, type ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import { ShareContactDialog } from './ShareContactDialog.dom.tsx';
import type { ShareContactDialogProps } from './ShareContactDialog.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.std.ts';
import type {
  ShareContactAvatarType,
  ShareContactDraftType,
} from '../util/shareContact.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ShareContactDialog',
} satisfies Meta;

const PAIGE = getDefaultConversation({
  id: 'paige',
  title: 'Paige Hall',
  titleNoDefault: 'Paige Hall',
  systemGivenName: 'Paige',
  systemFamilyName: 'Hall',
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  e164: '+15101234567',
});

function mockContacts(count: number): ReadonlyArray<ConversationType> {
  const contacts = Array.from({ length: count }, (_, i) => {
    const contact = getDefaultConversation();
    // System contact with ACI
    if (i % 2 === 0) {
      return {
        ...contact,
        systemGivenName: contact.firstName,
        systemFamilyName: contact.familyName,
      };
    }
    // System contact with E164 but no ACI
    if (i % 3 === 0) {
      return {
        ...contact,
        serviceId: undefined,
        systemGivenName: contact.firstName,
        systemFamilyName: contact.familyName,
        e164: contact.e164 ?? '+15555550123',
      };
    }
    // Non-system contact with E164 but no ACI
    if (i % 5 === 0) {
      return {
        ...contact,
        serviceId: undefined,
        systemGivenName: contact.firstName,
        systemFamilyName: contact.familyName,
        e164: contact.e164 ?? '+15555550123',
      };
    }

    // Non-system contact with ACI
    return contact;
  });
  return [PAIGE, ...contacts];
}

const CONTACT_AVATAR: ShareContactAvatarType = {
  url: '/fixtures/kitten-3-64-64.jpg',
  isProfile: false,
  attachment: { path: 'kitten-3-64-64.jpg' },
};

const PROFILE_AVATAR: ShareContactAvatarType = {
  url: '/fixtures/kitten-1-64-64.jpg',
  isProfile: true,
  attachment: { path: 'kitten-1-64-64.jpg' },
};

function mockDraft(
  overrides: Partial<ShareContactDraftType> = {}
): ShareContactDraftType {
  return {
    aci: generateAci(),
    avatar: CONTACT_AVATAR,
    avatarOptions: [CONTACT_AVATAR, PROFILE_AVATAR],
    name: { givenName: 'Paige', familyName: 'Hall' },
    organization: null,
    e164: '+15101234567',
    nickname: null,
    note: null,
    ...overrides,
  };
}

function createProps(
  overrides: Partial<ShareContactDialogProps> = {}
): ShareContactDialogProps {
  return {
    i18n,
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    theme: useContext(StorybookThemeContext),
    getPreferredBadge: () => undefined,
    contacts: mockContacts(30),
    recipientTitle: 'Maya Johnson',
    ourRegionCode: 'US',
    getContactDraft: () => mockDraft(),
    onClose: action('onClose'),
    onShareContact: action('onShareContact'),
    ...overrides,
  };
}

export function Default(): ReactNode {
  return <ShareContactDialog {...createProps()} />;
}

export function NoContacts(): ReactNode {
  return <ShareContactDialog {...createProps({ contacts: [] })} />;
}

export function WithNicknameAndNotes(): ReactNode {
  return (
    <ShareContactDialog
      {...createProps({
        getContactDraft: () =>
          mockDraft({
            nickname: { givenName: 'Paige', familyName: undefined },
            note: 'Met in 2017',
          }),
      })}
    />
  );
}

export function NotOnSignal(): ReactNode {
  return (
    <ShareContactDialog
      {...createProps({
        getContactDraft: () => mockDraft({ aci: null }),
      })}
    />
  );
}

export function PhoneNumberOnly(): ReactNode {
  return (
    <ShareContactDialog
      {...createProps({
        getContactDraft: () =>
          mockDraft({
            aci: null,
            avatar: null,
            avatarOptions: [],
            name: null,
          }),
      })}
    />
  );
}

export function NoPhotos(): ReactNode {
  return (
    <ShareContactDialog
      {...createProps({
        getContactDraft: () => mockDraft({ avatar: null, avatarOptions: [] }),
      })}
    />
  );
}

export function ProfilePhotoOnly(): ReactNode {
  return (
    <ShareContactDialog
      {...createProps({
        getContactDraft: () =>
          mockDraft({
            avatar: PROFILE_AVATAR,
            avatarOptions: [PROFILE_AVATAR],
          }),
      })}
    />
  );
}
