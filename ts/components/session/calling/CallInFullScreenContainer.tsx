import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { setFullScreenCall } from '../../../state/ducks/conversations';
import {
  getCallIsInFullScreen,
  getHasOngoingCall,
  getHasOngoingCallWith,
} from '../../../state/selectors/conversations';

const CallInFullScreenVisible = styled.div`
  position: absolute;
  z-index: 9;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--color-modal-background);
  border: var(--session-border);
  opacity: 0.9;
`;

export const CallInFullScreenContainer = () => {
  const dispatch = useDispatch();
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  //   const selectedConversationKey = useSelector(getSelectedConversationKey);
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const hasOngoingCallFullScreen = useSelector(getCallIsInFullScreen);

  //   const ongoingCallPubkey = ongoingCallProps?.id;
  //   const ongoingCallUsername = ongoingCallProps?.profileName || ongoingCallProps?.name;
  //   const videoRefRemote = useRef<any>();
  //   const videoRefLocal = useRef<any>();
  //   const mountedState = useMountedState();

  function toggleFullScreenOFF() {
    dispatch(setFullScreenCall(false));
  }

  if (!hasOngoingCall || !ongoingCallProps || !hasOngoingCallFullScreen) {
    return null;
  }

  return <CallInFullScreenVisible onClick={toggleFullScreenOFF} />;
};
