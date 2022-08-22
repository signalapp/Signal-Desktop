import React from 'react';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

type Props = {
  active: boolean;
  onClick: () => void;
  confirmationDialogParams?: any | undefined;
};

export const SessionToggle = (props: Props) => {
  const dispatch = useDispatch();

  const clickHandler = (event: React.MouseEvent<HTMLDivElement>) => {
    const stateManager = (e: any) => {
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
    <StyledSessionToggle role="button" onClick={clickHandler} active={props.active}>
      <StyledKnob active={props.active} />
    </StyledSessionToggle>
  );
};

const StyledKnob = styled.div<{ active: boolean }>`
  position: absolute;
  top: 0.5px;
  left: 0.5px;
  height: 27px;
  width: 27px;
  border-radius: 28px;
  background-color: white;
  box-shadow: 0 0 3px 1px rgba(0, 0, 0, 0.05), 0 3px 1px 0 rgba(0, 0, 0, 0.05),
    0 2px 2px 0 rgba(0, 0, 0, 0.1), 0 3px 3px 0 rgba(0, 0, 0, 0.05);

  transition: transform var(--default-duration) ease, background-color var(--default-duration) ease;

  transform: ${props => (props.active ? 'translateX(20px)' : '')};
`;

const StyledSessionToggle = styled.div<{ active: boolean }>`
  width: 51px;
  height: 31px;
  border: 1.5px solid #e5e5ea;
  border-radius: 16px;
  position: relative;

  cursor: pointer;
  background-color: rgba(0, 0, 0, 0);
  transition: var(--default-duration);

  background-color: ${props => (props.active ? 'var(--color-accent)' : 'unset')};
  border-color: ${props => (props.active ? 'var(--color-accent)' : 'unset')};
`;
