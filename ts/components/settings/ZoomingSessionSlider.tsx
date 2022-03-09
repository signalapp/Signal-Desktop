import Slider from 'rc-slider';
import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import { SessionSettingsItemWrapper } from './SessionSettingListItem';

export const ZoomingSessionSlider = (props: { onSliderChange?: (value: number) => void }) => {
  const forceUpdate = useUpdate();
  const handleSlider = (valueToForward: number) => {
    props?.onSliderChange?.(valueToForward);
    window.setSettingValue('zoom-factor-setting', valueToForward);
    window.updateZoomFactor();
    forceUpdate();
  };
  const currentValueFromSettings = window.getSettingValue('zoom-factor-setting') || 100;

  return (
    <SessionSettingsItemWrapper title={window.i18n('zoomFactorSettingTitle')} inline={false}>
      <div className="slider-wrapper">
        <Slider
          dots={true}
          step={20}
          min={60}
          max={200}
          defaultValue={currentValueFromSettings}
          onAfterChange={handleSlider}
        />

        <div className="slider-info">
          <p>{currentValueFromSettings}%</p>
        </div>
      </div>
    </SessionSettingsItemWrapper>
  );
};
