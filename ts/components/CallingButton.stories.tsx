// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { number, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import {
  CallingButton,
  CallingButtonType,
  PropsType,
  TooltipDirection,
} from './CallingButton';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  buttonType: select(
    'buttonType',
    CallingButtonType,
    overrideProps.buttonType || CallingButtonType.HANG_UP
  ),
  i18n,
  onClick: action('on-click'),
  tooltipDirection: select(
    'tooltipDirection',
    TooltipDirection,
    overrideProps.tooltipDirection || TooltipDirection.DOWN
  ),
  tooltipDistance: number(
    'tooltipDistance',
    overrideProps.tooltipDistance || 16
  ),
});

const story = storiesOf('Components/CallingButton', module);

story.add('Default', () => {
  const props = createProps();
  return <CallingButton {...props} />;
});

story.add('Audio On', () => {
  const props = createProps({
    buttonType: CallingButtonType.AUDIO_ON,
  });
  return <CallingButton {...props} />;
});

story.add('Audio Off', () => {
  const props = createProps({
    buttonType: CallingButtonType.AUDIO_OFF,
  });
  return <CallingButton {...props} />;
});

story.add('Audio Disabled', () => {
  const props = createProps({
    buttonType: CallingButtonType.AUDIO_DISABLED,
  });
  return <CallingButton {...props} />;
});

story.add('Video On', () => {
  const props = createProps({
    buttonType: CallingButtonType.VIDEO_ON,
  });
  return <CallingButton {...props} />;
});

story.add('Video Off', () => {
  const props = createProps({
    buttonType: CallingButtonType.VIDEO_OFF,
  });
  return <CallingButton {...props} />;
});

story.add('Video Disabled', () => {
  const props = createProps({
    buttonType: CallingButtonType.VIDEO_DISABLED,
  });
  return <CallingButton {...props} />;
});

story.add('Tooltip right', () => {
  const props = createProps({
    tooltipDirection: TooltipDirection.RIGHT,
  });
  return <CallingButton {...props} />;
});
