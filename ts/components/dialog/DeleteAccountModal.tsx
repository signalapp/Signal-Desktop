import React, { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { SnodeAPI } from '../../session/apis/snode_api/SNodeAPI';

import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/sync/syncUtils';
import { updateConfirmModal, updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SpacerLG } from '../basic/Text';

import { Data } from '../../data/data';
import { deleteAllLogs } from '../../node/logs';
import { clearInbox } from '../../session/apis/open_group_api/sogsv3/sogsV3ClearInbox';
import { getAllValidOpenGroupV2ConversationRoomInfos } from '../../session/apis/open_group_api/utils/OpenGroupUtils';
import { SessionRadioGroup } from '../basic/SessionRadioGroup';
import { ed25519Str } from '../../session/utils/String';

const deleteDbLocally = async () => {
  window?.log?.info('last message sent successfully. Deleting everything');
  window.persistStore?.purge();
  window?.log?.info('store purged');

  await deleteAllLogs();
  window?.log?.info('deleteAllLogs: done');

  await Data.removeAll();
  window?.log?.info('Data.removeAll: done');

  await Data.close();
  window?.log?.info('Data.close: done');
  await Data.removeDB();
  window?.log?.info('Data.removeDB: done');

  await Data.removeOtherData();
  window?.log?.info('Data.removeOtherData: done');

  window.localStorage.setItem('restart-reason', 'delete-account');
};

async function sendConfigMessageAndDeleteEverything() {
  try {
    // DELETE LOCAL DATA ONLY, NOTHING ON NETWORK
    window?.log?.info('DeleteAccount => Sending a last SyncConfiguration');

    // be sure to wait for the message being effectively sent. Otherwise we won't be able to encrypt it for our devices !
    await forceSyncConfigurationNowIfNeeded(true);
    window?.log?.info('Last configuration message sent!');
    await deleteDbLocally();
    window.restart();
  } catch (error) {
    // if an error happened, it's not related to the delete everything on network logic as this is handled above.
    // this could be a last sync configuration message not being sent.
    // in all case, we delete everything, and restart
    window?.log?.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteDbLocally();
    } catch (e) {
      window?.log?.error(e);
    } finally {
      window.restart();
    }
  }
}

async function deleteEverythingAndNetworkData() {
  try {
    // DELETE EVERYTHING ON NETWORK, AND THEN STUFF LOCALLY STORED
    // a bit of duplicate code below, but it's easier to follow every case like that (helped with returns)

    // clear all sogs inboxes (includes message requests)
    const allRoomInfos = await getAllValidOpenGroupV2ConversationRoomInfos();
    if (allRoomInfos && allRoomInfos.size > 0) {
      // clear each inbox per sogs
      // eslint-disable-next-line no-restricted-syntax
      for (const roomInfo of allRoomInfos.values()) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const success = await clearInbox(roomInfo);
          if (!success) {
            throw Error(`Failed to clear inbox for ${roomInfo.conversationId}`);
          }
        } catch (error) {
          window.log.info('DeleteAccount =>', error);
          continue;
        }
      }
    }

    // send deletion message to the network
    const potentiallyMaliciousSnodes = await SnodeAPI.forceNetworkDeletion();
    if (potentiallyMaliciousSnodes === null) {
      window?.log?.warn('DeleteAccount => forceNetworkDeletion failed');

      // close this dialog
      window.inboxStore?.dispatch(updateDeleteAccountModal(null));
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedDesc'),
          okTheme: SessionButtonColor.Danger,
          okText: window.i18n('deviceOnly'),
          onClickOk: async () => {
            await deleteDbLocally();
            window.restart();
          },
          onClickClose: () => {
            window.inboxStore?.dispatch(updateConfirmModal(null));
          },
        })
      );
      return;
    }

    if (potentiallyMaliciousSnodes.length > 0) {
      const snodeStr = potentiallyMaliciousSnodes.map(ed25519Str);
      window?.log?.warn(
        'DeleteAccount => forceNetworkDeletion Got some potentially malicious snodes',
        snodeStr
      );
      // close this dialog
      window.inboxStore?.dispatch(updateDeleteAccountModal(null));
      // open a new confirm dialog to ask user what to do
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedMultiple', [
            potentiallyMaliciousSnodes.join(', '),
          ]),
          messageSub: window.i18n('dialogClearAllDataDeletionFailedTitleQuestion'),
          okTheme: SessionButtonColor.Danger,
          okText: window.i18n('deviceOnly'),
          onClickOk: async () => {
            await deleteDbLocally();
            window.restart();
          },
          onClickClose: () => {
            window.inboxStore?.dispatch(updateConfirmModal(null));
          },
        })
      );
      return;
    }

    // We removed everything on the network successfully (no malicious node!). Now delete the stuff we got locally
    // without sending a last configuration message (otherwise this one will still be on the network)
    await deleteDbLocally();
    window.restart();
  } catch (error) {
    // if an error happened, it's not related to the delete everything on network logic as this is handled above.
    // this could be a last sync configuration message not being sent.
    // in all case, we delete everything, and restart
    window?.log?.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteDbLocally();
    } catch (e) {
      window?.log?.error(e);
    }
    window.restart();
  }
}

const DEVICE_ONLY = 'device_only';
const DEVICE_AND_NETWORK = 'device_and_network';
type DeleteModes = typeof DEVICE_ONLY | typeof DEVICE_AND_NETWORK;

const DescriptionBeforeAskingConfirmation = (props: {
  deleteMode: DeleteModes;
  setDeleteMode: (deleteMode: DeleteModes) => void;
}) => {
  const { deleteMode, setDeleteMode } = props;
  return (
    <>
      <span className="session-confirm-main-message">{window.i18n('deleteAccountWarning')}</span>
      <span className="session-confirm-main-message">
        {window.i18n('dialogClearAllDataDeletionQuestion')}
      </span>

      <SpacerLG />
      <SessionRadioGroup
        group="delete_account"
        initialItem={deleteMode}
        onClick={value => {
          if (value === DEVICE_ONLY || value === DEVICE_AND_NETWORK) {
            setDeleteMode(value);
          }
        }}
        items={[
          { label: window.i18n('deviceOnly'), value: DEVICE_ONLY },
          { label: window.i18n('entireAccount'), value: 'device_and_network' },
        ]}
      />
    </>
  );
};

const DescriptionWhenAskingConfirmation = (props: { deleteMode: DeleteModes }) => {
  return (
    <span className="session-confirm-main-message">
      {props.deleteMode === 'device_and_network'
        ? window.i18n('areYouSureDeleteEntireAccount')
        : window.i18n('areYouSureDeleteDeviceOnly')}
    </span>
  );
};

export const DeleteAccountModal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [askingConfirmation, setAskingConfirmation] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteModes>(DEVICE_ONLY);

  const dispatch = useDispatch();

  const onDeleteEverythingLocallyOnly = async () => {
    if (!isLoading) {
      setIsLoading(true);
      try {
        window.log.warn('Deleting everything on device but keeping network data');

        await sendConfigMessageAndDeleteEverything();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const onDeleteEverythingAndNetworkData = async () => {
    if (!isLoading) {
      setIsLoading(true);
      try {
        window.log.warn('Deleting everything including network data');
        await deleteEverythingAndNetworkData();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = useCallback(() => {
    dispatch(updateDeleteAccountModal(null));
  }, [dispatch]);

  return (
    <SessionWrapperModal
      title={window.i18n('clearAllData')}
      onClose={onClickCancelHandler}
      showExitIcon={true}
    >
      {askingConfirmation ? (
        <DescriptionWhenAskingConfirmation deleteMode={deleteMode} />
      ) : (
        <DescriptionBeforeAskingConfirmation
          deleteMode={deleteMode}
          setDeleteMode={setDeleteMode}
        />
      )}
      <div className="session-modal__centered">
        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('clear')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              if (!askingConfirmation) {
                setAskingConfirmation(true);
                return;
              }
              if (deleteMode === 'device_only') {
                void onDeleteEverythingLocallyOnly();
              } else if (deleteMode === 'device_and_network') {
                void onDeleteEverythingAndNetworkData();
              }
            }}
            disabled={isLoading}
          />

          <SessionButton
            text={window.i18n('cancel')}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              dispatch(updateDeleteAccountModal(null));
            }}
            disabled={isLoading}
          />
        </div>
        <SpacerLG />
        <SessionSpinner loading={isLoading} />
      </div>
    </SessionWrapperModal>
  );
};
