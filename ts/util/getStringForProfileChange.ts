import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';

export type ProfileNameChangeType = {
  type: 'name';
  oldName: string;
  newName: string;
};

export function getStringForProfileChange(
  change: ProfileNameChangeType,
  changedContact: ConversationType,
  i18n: LocalizerType
): string {
  if (change.type === 'name') {
    return changedContact.name
      ? i18n('contactChangedProfileName', {
          sender: changedContact.title,
          oldProfile: change.oldName,
          newProfile: change.newName,
        })
      : i18n('changedProfileName', {
          oldProfile: change.oldName,
          newProfile: change.newName,
        });
  }

  throw new Error('TimelineItem: Unknown type!');
}
