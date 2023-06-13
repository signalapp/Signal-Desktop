import React, { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { getRightOverlayMode } from '../../../state/selectors/section';
import { ReleasedFeatures } from '../../../util/releaseFeature';
import { OverlayDisappearingMessages } from './overlay/disappearing-messages/OverlayDisappearingMessages';
import { OverlayRightPanelSettings } from './overlay/OverlayRightPanelSettings';

const ClosableOverlay = () => {
  const rightOverlayMode = useSelector(getRightOverlayMode);
  const [showNewDisppearingMessageModes, setShowNewDisppearingMessageModes] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    ReleasedFeatures.checkIsDisappearMessageV2FeatureReleased()
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
  }, []);

  switch (rightOverlayMode) {
    case 'disappearing-messages':
      // TODO legacy messages support will be removed in a future release
      return <OverlayDisappearingMessages unlockNewModes={showNewDisppearingMessageModes} />;
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
