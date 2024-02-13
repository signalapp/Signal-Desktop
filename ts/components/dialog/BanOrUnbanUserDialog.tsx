import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useFocusMount } from '../../hooks/useFocusMount';
import { useConversationPropsById } from '../../hooks/useParamSelector';
import { ConversationModel } from '../../models/conversation';
import {
  sogsV3BanUser,
  sogsV3UnbanUser,
} from '../../session/apis/open_group_api/sogsv3/sogsV3BanUnban';
import { getConversationController } from '../../session/conversations/ConversationController';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { BanType, updateBanOrUnbanUserModal } from '../../state/ducks/modalDialog';
import { isDarkTheme } from '../../state/selectors/theme';
import { SessionHeaderSearchInput } from '../SessionHeaderSearchInput';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SpacerSM } from '../basic/Text';

async function banOrUnBanUserCall(
  convo: ConversationModel,
  textValue: string,
  banType: BanType,
  deleteAll: boolean
) {
  // if we don't have valid data entered by the user
  const pubkey = PubKey.from(textValue);
  if (!pubkey) {
    window.log.info(`invalid pubkey for ${banType} user:${textValue}`);
    ToastUtils.pushInvalidPubKey();
    return false;
  }
  try {
    // this is a v2 opengroup
    const roomInfos = convo.toOpenGroupV2();
    const isChangeApplied =
      banType === 'ban'
        ? await sogsV3BanUser(pubkey, roomInfos, deleteAll)
        : await sogsV3UnbanUser(pubkey, roomInfos);

    if (!isChangeApplied) {
      window?.log?.warn(`failed to ${banType} user: ${isChangeApplied}`);

      // eslint-disable-next-line no-unused-expressions
      banType === 'ban' ? ToastUtils.pushUserBanFailure() : ToastUtils.pushUserUnbanSuccess();
      return false;
    }
    window?.log?.info(`${pubkey.key} user ${banType}ned successfully...`);
    // eslint-disable-next-line no-unused-expressions
    banType === 'ban' ? ToastUtils.pushUserBanSuccess() : ToastUtils.pushUserUnbanSuccess();
    return true;
  } catch (e) {
    window?.log?.error(`Got error while ${banType}ning user:`, e);

    return false;
  }
}

export const BanOrUnBanUserDialog = (props: {
  conversationId: string;
  banType: BanType;
  pubkey?: string;
}) => {
  const { conversationId, banType, pubkey } = props;
  const { i18n } = window;
  const isBan = banType === 'ban';
  const dispatch = useDispatch();
  const darkMode = useSelector(isDarkTheme);
  const convo = getConversationController().get(conversationId);
  const inputRef = useRef(null);

  useFocusMount(inputRef, true);
  const wasGivenAPubkey = Boolean(pubkey?.length);
  const [inputBoxValue, setInputBoxValue] = useState('');
  const [inProgress, setInProgress] = useState(false);

  const sourceConvoProps = useConversationPropsById(pubkey);

  const inputTextToDisplay =
    wasGivenAPubkey && sourceConvoProps
      ? `${sourceConvoProps.displayNameInProfile} ${PubKey.shorten(sourceConvoProps.id)}`
      : undefined;

  /**
   * Ban or Unban a user from an open group
   * @param deleteAll Delete all messages for that user in the group (only works with ban)
   */
  const banOrUnBanUser = async (deleteAll: boolean = false) => {
    const castedPubkey = pubkey?.length ? pubkey : inputBoxValue;

    window?.log?.info(`asked to ${banType} user: ${castedPubkey}, banAndDeleteAll:${deleteAll}`);
    setInProgress(true);
    const isBanned = await banOrUnBanUserCall(convo, castedPubkey, banType, deleteAll);
    if (isBanned) {
      // clear input box
      setInputBoxValue('');
      if (wasGivenAPubkey) {
        dispatch(updateBanOrUnbanUserModal(null));
      }
    }

    setInProgress(false);
  };

  const chatName = convo.getNicknameOrRealUsernameOrPlaceholder();
  const title = `${isBan ? window.i18n('banUser') : window.i18n('unbanUser')}: ${chatName}`;

  const onPubkeyBoxChanges = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputBoxValue(e.target.value?.trim() || '');
  };

  /**
   * Starts procedure for banning/unbanning user and all their messages using dialog
   */
  const startBanAndDeleteAllSequence = async () => {
    await banOrUnBanUser(true);
  };

  const buttonText = isBan ? i18n('banUser') : i18n('unbanUser');

  return (
    <SessionWrapperModal
      showExitIcon={true}
      title={title}
      onClose={() => {
        dispatch(updateBanOrUnbanUserModal(null));
      }}
    >
      <Flex container={true} flexDirection="column" alignItems="center">
        <SessionHeaderSearchInput
          ref={inputRef}
          type="text"
          darkMode={darkMode}
          placeholder={i18n('enterSessionID')}
          dir="auto"
          onChange={onPubkeyBoxChanges}
          disabled={inProgress || wasGivenAPubkey}
          value={wasGivenAPubkey ? inputTextToDisplay : inputBoxValue}
        />
        <Flex container={true}>
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={banOrUnBanUser}
            text={buttonText}
            disabled={inProgress}
          />
          {isBan && (
            <>
              <SpacerSM />
              <SessionButton
                buttonType={SessionButtonType.Simple}
                buttonColor={SessionButtonColor.Danger}
                onClick={startBanAndDeleteAllSequence}
                text={i18n('banUserAndDeleteAll')}
                disabled={inProgress}
              />
            </>
          )}
        </Flex>
        <SessionSpinner loading={inProgress} />
      </Flex>
    </SessionWrapperModal>
  );
};
