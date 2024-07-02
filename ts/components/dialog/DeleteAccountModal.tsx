import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

import { updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionSpinner } from '../loading';

import {
  deleteEverythingAndNetworkData,
  sendConfigMessageAndDeleteEverything,
} from '../../util/accountManager';
import { SessionRadioGroup } from '../basic/SessionRadioGroup';

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
