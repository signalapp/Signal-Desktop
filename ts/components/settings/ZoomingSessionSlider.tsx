import Slider from 'rc-slider';

import { isNumber } from 'lodash';

import useUpdate from 'react-use/lib/useUpdate';
import { SessionSettingsItemWrapper } from './SessionSettingListItem';

export const ZoomingSessionSlider = (props: { onSliderChange?: (value: number) => void }) => {
  const forceUpdate = useUpdate();
  const handleSlider = async (val: number | Array<number>) => {
    const newSetting = isNumber(val) ? val : val?.[0] || 1;

    props?.onSliderChange?.(newSetting);
    await window.setSettingValue('zoom-factor-setting', newSetting);
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
          onChange={e => {
            void handleSlider(e);
          }}
        />

        <div className="slider-info">
          <p>{currentValueFromSettings}%</p>
        </div>
      </div>
    </SessionSettingsItemWrapper>
  );
};
