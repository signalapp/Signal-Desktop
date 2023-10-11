// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './GroupNotification';
import { GroupNotification } from './GroupNotification';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

export default {
  title: 'Components/Conversation',
} satisfies Meta<Props>;

const i18n = setupI18n('en', enMessages);

type GroupNotificationStory = [string, Array<Props>];

const longName = '🍷🐓🥶'.repeat(50);

const stories: Array<GroupNotificationStory> = [
  [
    'Combo',
    [
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: 'Mrs. Ice',
                phoneNumber: '(202) 555-1001',
              }),
              getDefaultConversation({
                phoneNumber: '(202) 555-1002',
                title: 'Ms. Earth',
              }),
            ],
          },
          { type: 'name', newName: 'Fishing Stories' },
          { type: 'avatar' },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: 'Mrs. Ice',
                phoneNumber: '(202) 555-1001',
              }),
              getDefaultConversation({
                title: 'Ms. Earth',
                phoneNumber: '(202) 555-1002',
              }),
            ],
          },
          { type: 'name', newName: 'Fishing Stories' },
          { type: 'avatar' },
        ],
        i18n,
      },
    ],
  ],
  [
    'Joined group',
    [
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: '(202) 555-1000',
                phoneNumber: '(202) 555-1000',
              }),
              getDefaultConversation({
                title: 'Mrs. Ice',
                phoneNumber: '(202) 555-1001',
              }),
              getDefaultConversation({
                title: 'Ms. Earth',
                phoneNumber: '(202) 555-1002',
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: '(202) 555-1000',
                phoneNumber: '(202) 555-1000',
                isMe: true,
              }),
              getDefaultConversation({
                title: 'Mrs. Ice',
                phoneNumber: '(202) 555-1001',
              }),
              getDefaultConversation({
                title: 'Ms. Earth',
                phoneNumber: '(202) 555-1002',
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: 'Mr. Fire',
                phoneNumber: '(202) 555-1000',
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: 'Mr. Fire',
                phoneNumber: '(202) 555-1000',
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: 'Mr. Fire',
                phoneNumber: '(202) 555-1000',
                isMe: true,
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'add',
            contacts: [
              getDefaultConversation({
                title: 'Mr. Fire',
                phoneNumber: '(202) 555-1000',
                isMe: true,
              }),
              getDefaultConversation({
                title: 'Mrs. Ice',
                phoneNumber: '(202) 555-1001',
              }),
            ],
          },
        ],
        i18n,
      },
    ],
  ],
  [
    'Left group',
    [
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'remove',
            contacts: [
              getDefaultConversation({
                title: 'Mr. Fire',
                phoneNumber: '(202) 555-1000',
              }),
              getDefaultConversation({
                title: 'Mrs. Ice',
                phoneNumber: '(202) 555-1001',
              }),
              getDefaultConversation({
                title: 'Ms. Earth',
                phoneNumber: '(202) 555-1002',
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'remove',
            contacts: [
              getDefaultConversation({
                title: 'Mr. Fire',
                phoneNumber: '(202) 555-1000',
              }),
            ],
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        }),
        changes: [
          {
            type: 'remove',
            contacts: [
              getDefaultConversation({
                title: 'Alice',
                phoneNumber: '(202) 555-1000',
                isMe: true,
              }),
            ],
          },
        ],
        i18n,
      },
    ],
  ],
  [
    'Title changed',
    [
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'name',
            newName: 'New Group Name',
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        }),
        changes: [
          {
            type: 'name',
            newName: 'New Group Name',
          },
        ],
        i18n,
      },
    ],
  ],
  [
    'Avatar changed',
    [
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'avatar',
            newName: 'New Group Name',
          },
        ],
        i18n,
      },
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        }),
        changes: [
          {
            type: 'avatar',
            newName: 'New Group Name',
          },
        ],
        i18n,
      },
    ],
  ],
  [
    'Generic group update',
    [
      {
        from: getDefaultConversation({
          title: 'Alice',
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'general',
          },
        ],
        i18n,
      },
    ],
  ],
  [
    'Long name',
    [
      {
        from: getDefaultConversation({
          title: longName,
          phoneNumber: '(202) 555-1000',
        }),
        changes: [
          {
            type: 'general',
          },
        ],
        i18n,
      },
    ],
  ],
];

export const _GroupNotification = (): JSX.Element => (
  <>
    {stories.map(([title, propsArray]) => (
      <>
        <h3>{title}</h3>
        {propsArray.map((props, i) => (
          <div key={i} className="module-inline-notification-wrapper">
            <GroupNotification {...props} />
          </div>
        ))}
      </>
    ))}
  </>
);
