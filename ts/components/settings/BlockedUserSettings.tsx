import React from 'react';
import { useSelector } from 'react-redux';
import { unblockConvoById } from '../../interactions/conversationInteractions';
import { getConversationController } from '../../session/conversations';
import { getBlockedPubkeys } from '../../state/selectors/conversations';
import { SessionButtonColor } from '../basic/SessionButton';

import { SessionSettingButtonItem, SessionSettingsItemWrapper } from './SessionSettingListItem';

export const BlockedUserSettings = () => {
  const blockedNumbers = useSelector(getBlockedPubkeys);

  if (!blockedNumbers || blockedNumbers.length === 0) {
    return (
      <SessionSettingsItemWrapper
        inline={true}
        description={window.i18n('noBlockedContacts')}
        title={''}
      >
        {' '}
      </SessionSettingsItemWrapper>
    );
  }
  const blockedEntries = blockedNumbers.map(blockedEntry => {
    const currentModel = getConversationController().get(blockedEntry);
    let title: string;

    if (currentModel) {
      title = currentModel.getProfileName() || currentModel.getName() || window.i18n('anonymous');
    } else {
      title = window.i18n('anonymous');
    }
    return (
      <SessionSettingButtonItem
        key={blockedEntry}
        buttonColor={SessionButtonColor.Danger}
        buttonText={window.i18n('unblockUser')}
        title={title}
        onClick={async () => {
          await unblockConvoById(blockedEntry);
        }}
      />
    );
  });

  return <>{blockedEntries}</>;
};
