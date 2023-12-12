// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingButton';
import { CallingButton, CallingButtonType } from './CallingButton';
import { TooltipPlacement } from './Tooltip';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CallingButton',
  component: CallingButton,
  argTypes: {
    buttonType: {
      control: { type: 'select' },
      options: Object.values(CallingButtonType),
    },
    tooltipDirection: {
      control: { type: 'select' },
      options: Object.values(TooltipPlacement),
    },
  },
  args: {
    buttonType: CallingButtonType.RING_ON,
    i18n,
    onClick: action('on-click'),
    onMouseEnter: action('on-mouse-enter'),
    onMouseLeave: action('on-mouse-leave'),
    tooltipDirection: TooltipPlacement.Bottom,
  },
} satisfies Meta<PropsType>;

export function KitchenSink(args: PropsType): JSX.Element {
  return (
    <>
      {Object.values(CallingButtonType).map(buttonType => (
        <CallingButton key={buttonType} {...args} buttonType={buttonType} />
      ))}
    </>
  );
}

export function AudioOn(args: PropsType): JSX.Element {
  return <CallingButton {...args} buttonType={CallingButtonType.AUDIO_ON} />;
}

export function AudioOff(args: PropsType): JSX.Element {
  return <CallingButton {...args} buttonType={CallingButtonType.AUDIO_OFF} />;
}

export function AudioDisabled(args: PropsType): JSX.Element {
  return (
    <CallingButton {...args} buttonType={CallingButtonType.AUDIO_DISABLED} />
  );
}

export function VideoOn(args: PropsType): JSX.Element {
  return <CallingButton {...args} buttonType={CallingButtonType.VIDEO_ON} />;
}

export function VideoOff(args: PropsType): JSX.Element {
  return <CallingButton {...args} buttonType={CallingButtonType.VIDEO_OFF} />;
}

export function VideoDisabled(args: PropsType): JSX.Element {
  return (
    <CallingButton {...args} buttonType={CallingButtonType.VIDEO_DISABLED} />
  );
}

export function TooltipRight(args: PropsType): JSX.Element {
  return <CallingButton {...args} tooltipDirection={TooltipPlacement.Right} />;
}

export function PresentingOn(args: PropsType): JSX.Element {
  return (
    <CallingButton {...args} buttonType={CallingButtonType.PRESENTING_ON} />
  );
}

export function PresentingOff(args: PropsType): JSX.Element {
  return (
    <CallingButton {...args} buttonType={CallingButtonType.PRESENTING_OFF} />
  );
}
