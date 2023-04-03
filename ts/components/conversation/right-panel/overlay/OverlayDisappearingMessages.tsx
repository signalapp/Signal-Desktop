import React from 'react';
import { useDispatch } from 'react-redux';
import { resetRightOverlayMode } from '../../../../state/ducks/section';

export const OverlayDisappearingMessages = () => {
  const dispatch = useDispatch();

  function resetOverlay() {
    dispatch(resetRightOverlayMode());
  }

  // const timerOptions = useSelector(getTimerOptions).timerOptions;

  // const disappearingMessagesOptions = timerOptions.map(option => {
  //   return {
  //     content: option.name,
  //     onClick: () => {
  //       void setDisappearingMessagesByConvoId(id, option.value);
  //     },
  //   };
  // });

  return <div onClick={resetOverlay}>TODO</div>;
};
