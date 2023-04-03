import React, { useCallback, useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { getRightOverlayMode } from '../../../state/selectors/section';
import { checkIsFeatureReleased } from '../../../util/releaseFeature';
import { OverlayDisappearingMessages } from './overlay/OverlayDisappearingMessages';
import { OverlayRightPanelSettings } from './overlay/OverlayRightPanelSettings';

const ClosableOverlay = () => {
  const rightOverlayMode = useSelector(getRightOverlayMode);
  const [showNewDisppearingMessageModes, setShowNewDisppearingMessageModes] = useState(false);

  const checkForFeatureRelease = useCallback(async () => {
    const isReleased = await checkIsFeatureReleased('Disappearing Messages V2');
    return isReleased;
  }, []);

  useEffect(() => {
    let isCancelled = false;
    checkForFeatureRelease()
      .then(result => {
        if (isCancelled) {
          return;
        }
        setShowNewDisppearingMessageModes(result);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [checkForFeatureRelease]);

  switch (rightOverlayMode) {
    case 'disappearing-messages':
      // TODO legacy messages support will be removed in a future release
      return <OverlayDisappearingMessages unlockNewModes={showNewDisppearingMessageModes} />;
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
