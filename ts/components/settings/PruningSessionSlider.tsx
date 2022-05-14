import Slider from 'rc-slider';
import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import { SessionSettingsItemWrapper } from './SessionSettingListItem';
import { ToastUtils } from '../../session/utils';

export const PruningSessionSlider = (props: { onSliderChange?: (value: number) => void }) => {
  const forceUpdate = useUpdate();
  const handleSlider = (valueToForward: number) => {
    props?.onSliderChange?.(valueToForward);
    window.setSettingValue('prune-setting', valueToForward);
    ToastUtils.pushRestartNeeded();
    forceUpdate();
  };
  const currentValueFromSettings = window.getSettingValue('prune-setting') || 0;

  return (
    <SessionSettingsItemWrapper title={window.i18n('pruneSettingTitle')} description={window.i18n('pruneSettingDescription')} inline={false}>
      <div className="slider-wrapper">
        <Slider
          dots={true}
          step={1}
          min={0}
          max={12}
          defaultValue={currentValueFromSettings}
          onAfterChange={handleSlider}
        />

        <div className="slider-info">
          <p>{currentValueFromSettings} {currentValueFromSettings === 1 ? window.i18n('pruneSettingUnit') : window.i18n('pruneSettingUnits')}</p>
        </div>
      </div>
    </SessionSettingsItemWrapper>
  );
};
