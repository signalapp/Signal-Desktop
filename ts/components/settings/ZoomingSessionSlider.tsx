import Slider from 'rc-slider';

import { isNumber } from 'lodash';

import { useState } from 'react';
import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { Flex } from '../basic/Flex';
import { SessionSettingsItemWrapper } from './SessionSettingListItem';

const StyledZoomValue = styled.p`
  min-width: 40px;
  margin-inline-start: var(--margins-lg);
`;

export const ZoomingSessionSlider = (props: { onSliderChange?: (value: number) => void }) => {
  const [value, setValue] = useState(window.getSettingValue('zoom-factor-setting') || 100);
  const forceUpdate = useUpdate();
  const handleSlider = async (val: number | Array<number>) => {
    const newSetting = isNumber(val) ? val : val?.[0] || 1;

    props?.onSliderChange?.(newSetting);
    await window.setSettingValue('zoom-factor-setting', newSetting);
    window.updateZoomFactor();
    forceUpdate();
  };

  return (
    <SessionSettingsItemWrapper title={window.i18n('zoomFactorSettingTitle')} inline={false}>
      <Flex
        container={true}
        justifyContent={'flex-start'}
        alignItems={'center'}
        margin={'var(--margins-lg) var(--margins-sm)'}
      >
        <Slider
          dots={true}
          step={20}
          min={60}
          max={200}
          value={value}
          onChange={(val: number | Array<number>) => {
            setValue(isNumber(val) ? val : val?.[0] || 1);
          }}
          onChangeComplete={e => {
            void handleSlider(e);
          }}
        />
        <StyledZoomValue>{value}%</StyledZoomValue>
      </Flex>
    </SessionSettingsItemWrapper>
  );
};
