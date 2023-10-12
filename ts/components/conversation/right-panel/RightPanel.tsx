import React from 'react';

import { useRightOverlayMode } from '../../../hooks/useUI';
import { OverlayRightPanelSettings } from './overlay/OverlayRightPanelSettings';
import { OverlayDisappearingMessages } from './overlay/disappearing-messages/OverlayDisappearingMessages';

const ClosableOverlay = () => {
  const rightOverlayMode = useRightOverlayMode();

  switch (rightOverlayMode) {
    case 'disappearing-messages':
      return <OverlayDisappearingMessages />;
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
