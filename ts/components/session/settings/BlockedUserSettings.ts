import { unblockConvoById } from '../../../interactions/conversationInteractions';
import { getConversationController } from '../../../session/conversations';
import { BlockedNumberController } from '../../../util';
import { SessionButtonColor } from '../SessionButton';
import { LocalSettingType, SessionSettingType, SessionSettingCategory } from './LocalSettings';

export function getBlockedUserSettings(): Array<LocalSettingType> {
  const results: Array<LocalSettingType> = [];
  const blockedNumbers = BlockedNumberController.getBlockedNumbers();

  for (const blockedNumber of blockedNumbers) {
    let title: string;

    const currentModel = getConversationController().get(blockedNumber);
    if (currentModel) {
      title = currentModel.getProfileName() || currentModel.getName() || window.i18n('anonymous');
    } else {
      title = window.i18n('anonymous');
    }

    results.push({
      id: blockedNumber,
      title,
      description: '',
      type: SessionSettingType.Button,
      category: SessionSettingCategory.Blocked,
      content: {
        buttonColor: SessionButtonColor.Danger,
        buttonText: window.i18n('unblockUser'),
      },
      comparisonValue: undefined,
      setFn: async () => {
        await unblockConvoById(blockedNumber);
      },
      hidden: false,
      onClick: undefined,
    });
  }

  if (blockedNumbers.length === 0) {
    return [
      {
        id: 'noBlockedContacts',
        title: '',
        description: window.i18n('noBlockedContacts'),
        type: undefined,
        category: SessionSettingCategory.Blocked,
        content: undefined,
        comparisonValue: undefined,
        setFn: undefined,
        hidden: false,
        onClick: undefined,
      },
    ];
  }

  return results;
}
