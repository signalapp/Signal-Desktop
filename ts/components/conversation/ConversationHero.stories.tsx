import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { number as numberKnob, text } from '@storybook/addon-knobs';
import { ConversationHero } from './ConversationHero';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getName = () => text('name', 'Cayce Bollard');
const getProfileName = () => text('profileName', 'Cayce Bollard');
const getAvatarPath = () =>
  text('avatarPath', '/fixtures/kitten-4-112-112.jpg');
const getPhoneNumber = () => text('phoneNumber', '+1 (646) 327-2700');

storiesOf('Components/Conversation/ConversationHero', module)
  .add('Direct (Three Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          groups={['NYC Rock Climbers', 'Dinner Party', 'Friends 🌿']}
        />
      </div>
    );
  })
  .add('Direct (Two Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          groups={['NYC Rock Climbers', 'Dinner Party']}
        />
      </div>
    );
  })
  .add('Direct (One Other Group)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          groups={['NYC Rock Climbers']}
        />
      </div>
    );
  })
  .add('Direct (No Other Groups)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          avatarPath={getAvatarPath()}
          name={getName()}
          profileName={getProfileName()}
          phoneNumber={getPhoneNumber()}
          conversationType="direct"
          groups={[]}
        />
      </div>
    );
  })
  .add('Group (many members)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          name={text('groupName', 'NYC Rock Climbers')}
          phoneNumber={text('phoneNumber', '+1 (646) 327-2700')}
          conversationType="group"
          membersCount={numberKnob('membersCount', 22)}
        />
      </div>
    );
  })
  .add('Group (one member)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          name={text('groupName', 'NYC Rock Climbers')}
          phoneNumber={text('phoneNumber', '+1 (646) 327-2700')}
          conversationType="group"
          membersCount={1}
        />
      </div>
    );
  })
  .add('Group (zero members)', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          name={text('groupName', 'NYC Rock Climbers')}
          phoneNumber={text('phoneNumber', '+1 (646) 327-2700')}
          conversationType="group"
          membersCount={0}
        />
      </div>
    );
  })
  .add('Note to Self', () => {
    return (
      <div style={{ width: '480px' }}>
        <ConversationHero
          i18n={i18n}
          isMe={true}
          conversationType="direct"
          phoneNumber={getPhoneNumber()}
        />
      </div>
    );
  });
