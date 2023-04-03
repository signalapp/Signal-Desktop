import React from 'react';

import { useSelector } from 'react-redux';
import { getRightOverlayMode } from '../../../state/selectors/section';
import { OverlayDisappearingMessages } from './overlay/OverlayDisappearingMessages';
import { OverlayRightPanelSettings } from './overlay/OverlayRightPanelSettings';

const ClosableOverlay = () => {
  const rightOverlayMode = useSelector(getRightOverlayMode);
  switch (rightOverlayMode) {
    case 'disappearing-messages':
      return <OverlayDisappearingMessages />;
    case 'panel-settings':
    default:
      return <OverlayRightPanelSettings />;
  }
};

export const RightPanel = () => {
  return (
    <div className="right-panel">
      <ClosableOverlay />
    </div>
  );
};
