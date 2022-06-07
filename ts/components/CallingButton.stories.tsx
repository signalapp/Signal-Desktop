// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './CallingButton';
import { CallingButton, CallingButtonType } from './CallingButton';
import { TooltipPlacement } from './Tooltip';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  buttonType:
    overrideProps.buttonType ||
    select('buttonType', CallingButtonType, CallingButtonType.HANG_UP),
  i18n,
  onClick: action('on-click'),
  onMouseEnter: action('on-mouse-enter'),
  onMouseLeave: action('on-mouse-leave'),
  tooltipDirection: select(
    'tooltipDirection',
    TooltipPlacement,
    overrideProps.tooltipDirection || TooltipPlacement.Bottom
  ),
});

export default {
  title: 'Components/CallingButton',
};

export const KitchenSink = (): JSX.Element => {
  return (
    <>
      {Object.keys(CallingButtonType).map(buttonType => (
        <CallingButton
          key={buttonType}
          {...createProps({ buttonType: buttonType as CallingButtonType })}
        />
      ))}
    </>
  );
};

export const AudioOn = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.AUDIO_ON,
  });
  return <CallingButton {...props} />;
};

export const AudioOff = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.AUDIO_OFF,
  });
  return <CallingButton {...props} />;
};

export const AudioDisabled = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.AUDIO_DISABLED,
  });
  return <CallingButton {...props} />;
};

export const VideoOn = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.VIDEO_ON,
  });
  return <CallingButton {...props} />;
};

export const VideoOff = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.VIDEO_OFF,
  });
  return <CallingButton {...props} />;
};

export const VideoDisabled = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.VIDEO_DISABLED,
  });
  return <CallingButton {...props} />;
};

export const TooltipRight = (): JSX.Element => {
  const props = createProps({
    tooltipDirection: TooltipPlacement.Right,
  });
  return <CallingButton {...props} />;
};

TooltipRight.story = {
  name: 'Tooltip right',
};

export const PresentingOn = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.PRESENTING_ON,
  });
  return <CallingButton {...props} />;
};

export const PresentingOff = (): JSX.Element => {
  const props = createProps({
    buttonType: CallingButtonType.PRESENTING_OFF,
  });
  return <CallingButton {...props} />;
};
