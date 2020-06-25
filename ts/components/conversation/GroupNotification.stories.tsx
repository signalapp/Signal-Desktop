import * as React from 'react';

import { storiesOf } from '@storybook/react';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../_locales/en/messages.json';

import { GroupNotification, Props } from './GroupNotification';

const book = storiesOf('Components/Conversation', module);
const i18n = setupI18n('en', enMessages);

type GroupNotificationStory = [string, Array<Props>];

const stories: Array<GroupNotificationStory> = [
  [
    'Combo',
    [
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1001',
                profileName: 'Mrs. Ice',
              },
              {
                phoneNumber: '(202) 555-1002',
                name: 'Ms. Earth',
              },
            ],
          },
          { type: 'name', newName: 'Fishing Stories' },
          { type: 'avatar' },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1001',
                profileName: 'Mrs. Ice',
              },
              {
                phoneNumber: '(202) 555-1002',
                name: 'Ms. Earth',
              },
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
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
              },
              {
                phoneNumber: '(202) 555-1001',
                profileName: 'Mrs. Ice',
              },
              {
                phoneNumber: '(202) 555-1002',
                name: 'Ms. Earth',
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                isMe: true,
              },
              {
                phoneNumber: '(202) 555-1001',
                profileName: 'Mrs. Ice',
              },
              {
                phoneNumber: '(202) 555-1002',
                name: 'Ms. Earth',
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                profileName: 'Mr. Fire',
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                profileName: 'Mr. Fire',
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                profileName: 'Mr. Fire',
                isMe: true,
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'add',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                profileName: 'Mr. Fire',
                isMe: true,
              },
              {
                phoneNumber: '(202) 555-1001',
                profileName: 'Mrs. Ice',
              },
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
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'remove',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                profileName: 'Mr. Fire',
              },
              {
                phoneNumber: '(202) 555-1001',
                profileName: 'Mrs. Ice',
              },
              {
                phoneNumber: '(202) 555-1002',
                name: 'Ms. Earth',
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'remove',
            contacts: [
              {
                phoneNumber: '(202) 555-1000',
                profileName: 'Mr. Fire',
              },
            ],
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        },
        changes: [
          {
            type: 'remove',
            contacts: [
              {
                name: 'Alice',
                phoneNumber: '(202) 555-1000',
                isMe: true,
              },
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
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'name',
            newName: 'New Group Name',
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        },
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
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
        changes: [
          {
            type: 'avatar',
            newName: 'New Group Name',
          },
        ],
        i18n,
      },
      {
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
          isMe: true,
        },
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
        from: {
          name: 'Alice',
          phoneNumber: '(202) 555-1000',
        },
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

book.add('GroupNotification', () =>
  stories.map(([title, propsArray]) => (
    <>
      <h3>{title}</h3>
      {propsArray.map((props, i) => {
        return (
          <>
            <div key={i} className="module-message-container">
              <div className="module-inline-notification-wrapper">
                <GroupNotification {...props} />
              </div>
            </div>
          </>
        );
      })}
    </>
  ))
);
