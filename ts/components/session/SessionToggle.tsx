import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { useDispatch } from 'react-redux';

type Props = {
  active: boolean;
  onClick: () => void;
  confirmationDialogParams?: any | undefined;
};

export const SessionToggle = (props: Props) => {
  const [active, setActive] = useState(false);

  const dispatch = useDispatch();

  useEffect(() => {
    setActive(props.active);
  }, []);

  const clickHandler = (event: any) => {
    const stateManager = (e: any) => {
      setActive(!active);
      e.stopPropagation();
      props.onClick();
    };

    if (props.confirmationDialogParams && props.confirmationDialogParams.shouldShowConfirm) {
      // If item needs a confirmation dialog to turn ON, render it
      const closeConfirmModal = () => {
        dispatch(updateConfirmModal(null));
      };

      dispatch(
        updateConfirmModal({
          onClickOk: () => {
            stateManager(event);
            closeConfirmModal();
          },
          onClickClose: () => {
            updateConfirmModal(null);
          },
          ...props.confirmationDialogParams,
          updateConfirmModal,
        })
      );

      return;
    }

    stateManager(event);
  };

  return (
    <div
      className={classNames('session-toggle', active ? 'active' : '')}
      role="button"
      onClick={clickHandler}
    >
      <div className="knob" />
    </div>
  );
};
