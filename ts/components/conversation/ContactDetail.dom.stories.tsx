// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ContactDetail.dom.tsx';
import { ContactDetail } from './ContactDetail.dom.tsx';
import {
  AddressType,
  ContactFormType,
  type EmbeddedContactForUIType,
} from '../../types/EmbeddedContact.std.ts';
import { IMAGE_GIF } from '../../types/MIME.std.ts';
import { fakeAttachment } from '../../test-helpers/fakeAttachment.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import type { SharedContactResolutionType } from '../../util/sharedContact.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ContactDetail',
} satisfies Meta<Props>;

const emptyContact = {
  aci: undefined,
  nickname: undefined,
  note: undefined,
  resolution: { type: 'not-on-signal' },
} satisfies EmbeddedContactForUIType;

const createProps = (
  overrideProps: Partial<Props> & {
    hasSignalAccount?: boolean;
    resolution?: SharedContactResolutionType;
  } = {}
): Props => {
  const contact = overrideProps.contact || emptyContact;
  let resolution: SharedContactResolutionType = { type: 'not-on-signal' };
  if (overrideProps.resolution) {
    resolution = overrideProps.resolution;
  } else if (overrideProps.hasSignalAccount) {
    resolution = { type: 'aci', aci: contact.aci ?? generateAci() };
  }

  return {
    cancelAttachmentDownload: action('cancelAttachmentDownload'),
    contact: { ...contact, resolution },
    hasActiveCall: overrideProps.hasActiveCall ?? false,
    i18n,
    kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
    messageId: 'fake-message-id',
    onAddToGroup: action('onAddToGroup'),
    onSendMessage: action('onSendMessage'),
    onStartAudioCall: action('onStartAudioCall'),
    onStartVideoCall: action('onStartVideoCall'),
    ourRegionCode: 'US',
  };
};

const aci = generateAci();
const fullContact: EmbeddedContactForUIType = {
  address: [
    {
      type: AddressType.HOME,
      street: '555 Main St.',
      city: 'Boston',
      region: 'MA',
      postcode: '33333',
      pobox: '2323-444',
      country: 'US',
      neighborhood: 'Garden Place',
    },
    {
      type: AddressType.WORK,
      street: '333 Another St.',
      city: 'Boston',
      region: 'MA',
      postcode: '33344',
      pobox: '2424-555',
      country: 'US',
      neighborhood: 'Factory Place',
    },
    {
      type: AddressType.CUSTOM,
      street: '111 Dream St.',
      city: 'Miami',
      region: 'FL',
      postcode: '44232',
      pobox: '111-333',
      country: 'US',
      neighborhood: 'BeachVille',
      label: 'vacation',
    },
    {
      type: AddressType.CUSTOM,
      street: '333 Fake St.',
      city: 'Boston',
      region: 'MA',
      postcode: '33345',
      pobox: '123-444',
      country: 'US',
      neighborhood: 'Downtown',
    },
  ],
  avatar: {
    avatar: fakeAttachment({
      path: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
      contentType: IMAGE_GIF,
    }),
    isProfile: true,
  },
  email: [
    {
      value: 'jerjor@fakemail.com',
      type: ContactFormType.HOME,
    },
    {
      value: 'jerry.jordan@fakeco.com',
      type: ContactFormType.WORK,
    },
    {
      value: 'jj@privatething.net',
      type: ContactFormType.CUSTOM,
      label: 'private',
    },
    {
      value: 'jordan@another.net',
      type: ContactFormType.CUSTOM,
    },
  ],
  name: {
    givenName: 'Jerry',
    familyName: 'Jordan',
    prefix: 'Dr.',
    suffix: 'Jr.',
    middleName: 'James',
  },
  number: [
    {
      value: '555-444-2323',
      type: ContactFormType.HOME,
    },
    {
      value: '555-444-3232',
      type: ContactFormType.WORK,
    },
    {
      value: '555-666-3232',
      type: ContactFormType.MOBILE,
    },
    {
      value: '333-666-3232',
      type: ContactFormType.CUSTOM,
      label: 'special',
    },
    {
      value: '333-777-3232',
      type: ContactFormType.CUSTOM,
    },
  ],
  aci,
  note: 'This is an important and long note \n with line\n breaks.',
  nickname: {
    givenName: 'NickGiven',
    familyName: 'NickFamily',
  },
  resolution: { type: 'aci', aci },
};

export function FullyFilledOut(): JSX.Element {
  const props = createProps({
    contact: fullContact,
    hasSignalAccount: true,
  });
  return <ContactDetail {...props} />;
}

export function FullyFilledOutNotDownloaded(): JSX.Element {
  const props = createProps({
    contact: fullContact,
    hasSignalAccount: true,
  });
  const propsWithUpdatedAvatar = {
    ...props,
    contact: {
      ...props.contact,
      avatar: {
        avatar: fakeAttachment({
          path: undefined,
          contentType: IMAGE_GIF,
        }),
        isProfile: true,
      },
    },
  };
  return <ContactDetail {...propsWithUpdatedAvatar} />;
}
export function FullyFilledOutDownloading(): JSX.Element {
  const props = createProps({
    contact: fullContact,
    hasSignalAccount: true,
  });
  const propsWithUpdatedAvatar = {
    ...props,
    contact: {
      ...props.contact,
      avatar: {
        avatar: fakeAttachment({
          path: undefined,
          contentType: IMAGE_GIF,
          pending: true,
          size: 10000000,
          totalDownloaded: 500000,
        }),
        isProfile: true,
      },
    },
  };
  return <ContactDetail {...propsWithUpdatedAvatar} />;
}
export function FullyFilledOutTransientError(): JSX.Element {
  const props = createProps({
    contact: fullContact,
    hasSignalAccount: true,
  });
  const propsWithUpdatedAvatar = {
    ...props,
    contact: {
      ...props.contact,
      avatar: {
        avatar: fakeAttachment({
          error: true,
          key: 'something',
          digest: 'something',
          cdnKey: 'something',
          cdnNumber: 2,
          path: undefined,
          contentType: IMAGE_GIF,
        }),
        isProfile: true,
      },
    },
  };
  return <ContactDetail {...propsWithUpdatedAvatar} />;
}
export function FullyFilledOutPermanentError(): JSX.Element {
  const props = createProps({
    contact: fullContact,
    hasSignalAccount: true,
  });
  const propsWithUpdatedAvatar = {
    ...props,
    contact: {
      ...props.contact,
      avatar: {
        avatar: fakeAttachment({
          error: true,
          path: undefined,
          contentType: IMAGE_GIF,
        }),
        isProfile: true,
      },
    },
  };
  return <ContactDetail {...propsWithUpdatedAvatar} />;
}

export function OnlyEmail(): JSX.Element {
  const props = createProps({
    contact: {
      email: [
        {
          value: 'jerjor@fakemail.com',
          type: ContactFormType.HOME,
        },
      ],
      aci: undefined,
      note: undefined,
      nickname: undefined,
      resolution: { type: 'not-on-signal' },
    },
    hasSignalAccount: true,
  });

  return <ContactDetail {...props} />;
}

export function GivenName(): JSX.Element {
  const props = createProps({
    contact: {
      ...emptyContact,
      name: {
        givenName: 'Jerry',
      },
    },
    hasSignalAccount: true,
  });

  return <ContactDetail {...props} />;
}

export function Organization(): JSX.Element {
  const props = createProps({
    contact: {
      ...emptyContact,
      organization: 'Company 5',
    },
    hasSignalAccount: true,
  });

  return <ContactDetail {...props} />;
}

export function GivenFamilyName(): JSX.Element {
  const props = createProps({
    contact: {
      ...emptyContact,
      name: {
        givenName: 'Jerry',
        familyName: 'FamilyName',
      },
    },
    hasSignalAccount: true,
  });

  return <ContactDetail {...props} />;
}

export function FamilyName(): JSX.Element {
  const props = createProps({
    contact: {
      ...emptyContact,
      name: {
        familyName: 'FamilyName',
      },
    },
    hasSignalAccount: true,
  });

  return <ContactDetail {...props} />;
}

export function LoadingAvatar(): JSX.Element {
  const props = createProps({
    contact: {
      ...emptyContact,
      avatar: {
        avatar: fakeAttachment({
          contentType: IMAGE_GIF,
          pending: true,
        }),
        isProfile: true,
      },
    },
    hasSignalAccount: true,
  });
  return <ContactDetail {...props} />;
}

export function EmptyWithAccount(): JSX.Element {
  const props = createProps({
    hasSignalAccount: true,
  });
  return <ContactDetail {...props} />;
}

export function EmptyWithoutAccount(): JSX.Element {
  const props = createProps({
    hasSignalAccount: false,
  });
  return <ContactDetail {...props} />;
}

export function FullyFilledOutWithoutAccount(): JSX.Element {
  const props = createProps({
    contact: { ...fullContact, aci: undefined },
    hasSignalAccount: false,
  });
  return <ContactDetail {...props} />;
}

export function InAnotherCall(): JSX.Element {
  const props = createProps({
    contact: fullContact,
    hasActiveCall: true,
    hasSignalAccount: true,
  });
  return <ContactDetail {...props} />;
}
