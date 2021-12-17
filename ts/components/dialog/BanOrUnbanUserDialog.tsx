import React, { useRef, useState } from 'react';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { Flex } from '../basic/Flex';
import { useDispatch } from 'react-redux';
import { BanType, updateBanOrUnbanUserModal } from '../../state/ducks/modalDialog';
import { SpacerSM } from '../basic/Text';
import { getConversationController } from '../../session/conversations/ConversationController';
import { ApiV2 } from '../../session/apis/open_group_api/opengroupV2';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { ConversationModel } from '../../models/conversation';
import { useFocusMount } from '../../hooks/useFocusMount';
import { useConversationPropsById } from '../../hooks/useParamSelector';
// tslint:disable: use-simple-attributes

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
        ? await ApiV2.banUser(pubkey, roomInfos, deleteAll)
        : await ApiV2.unbanUser(pubkey, roomInfos);

    if (!isChangeApplied) {
      window?.log?.warn(`failed to ${banType} user: ${isChangeApplied}`);

      banType === 'ban' ? ToastUtils.pushUserBanFailure() : ToastUtils.pushUserUnbanSuccess();
      return false;
    }
    window?.log?.info(`${pubkey.key} user ${banType}ned successfully...`);
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
  const convo = getConversationController().get(conversationId);
  const inputRef = useRef(null);

  useFocusMount(inputRef, true);
  const wasGivenAPubkey = Boolean(pubkey?.length);
  const [inputBoxValue, setInputBoxValue] = useState('');
  const [inProgress, setInProgress] = useState(false);

  const sourceConvoProps = useConversationPropsById(pubkey);

  const inputTextToDisplay =
    wasGivenAPubkey && sourceConvoProps
      ? `${sourceConvoProps.profileName} ${PubKey.shorten(sourceConvoProps.id)}`
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

  const chatName = convo.get('name');
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
        <input
          ref={inputRef}
          type="text"
          className="module-main-header__search__input"
          placeholder={i18n('enterSessionID')}
          dir="auto"
          onChange={onPubkeyBoxChanges}
          disabled={inProgress || wasGivenAPubkey}
          value={wasGivenAPubkey ? inputTextToDisplay : inputBoxValue}
        />
        <Flex container={true}>
          <SessionButton
            buttonType={SessionButtonType.Square}
            buttonColor={SessionButtonColor.Primary}
            onClick={banOrUnBanUser}
            text={buttonText}
            disabled={inProgress}
          />
          {isBan && (
            <>
              <SpacerSM />
              <SessionButton
                buttonType={SessionButtonType.Square}
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
