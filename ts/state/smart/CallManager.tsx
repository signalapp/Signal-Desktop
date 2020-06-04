import { RefObject } from 'react';
import { connect } from 'react-redux';
import { CanvasVideoRenderer, GumVideoCapturer } from 'ringrtc';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.calling,
    i18n: getIntl(state),
    getVideoCapturer: (localVideoRef: RefObject<HTMLVideoElement>) =>
      new GumVideoCapturer(640, 480, 30, localVideoRef),
    getVideoRenderer: (remoteVideoRef: RefObject<HTMLCanvasElement>) =>
      new CanvasVideoRenderer(remoteVideoRef),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
