// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './RemoteMegaphone.dom.js';
import { RemoteMegaphone } from './RemoteMegaphone.dom.js';
import { type ComponentMeta } from '../storybook/types.std.js';
import type {
  MegaphoneCtaId,
  RemoteMegaphoneId,
} from '../types/Megaphone.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/RemoteMegaphone',
  component: RemoteMegaphone,
  argTypes: {},
  args: {
    i18n,
    remoteMegaphoneId: 'a' as RemoteMegaphoneId,
    primaryCtaId: 'donate' as MegaphoneCtaId,
    secondaryCtaId: 'snooze' as MegaphoneCtaId,
    primaryCtaText: 'Donate',
    secondaryCtaText: 'Not now',
    title: 'Donate to Signal',
    body: 'Signal is powered by people like you. Show your support today!',
    imagePath: 'images/donate-heart.png',
    isFullSize: true,
    onClickNarrowMegaphone: action('onClickNarrowMegaphone'),
    onInteractWithMegaphone: action('onInteractWithMegaphone'),
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): React.JSX.Element {
  return <RemoteMegaphone {...args} />;
}

export function AlternateText(args: PropsType): React.JSX.Element {
  return (
    <RemoteMegaphone
      {...args}
      title="Donate Today"
      body="As a nonprofit, Signal needs your support"
    />
  );
}

export function ShortText(args: PropsType): React.JSX.Element {
  return <RemoteMegaphone {...args} title="Donate Today" body="Pls halp" />;
}

export function LongText(args: PropsType): React.JSX.Element {
  return (
    <RemoteMegaphone
      {...args}
      title="We Need Your Help, Donate to Signal Today"
      body="As a nonprofit, Signal is powered by people like you. Show your support today!"
    />
  );
}

export function LongButtons(args: PropsType): React.JSX.Element {
  return (
    <RemoteMegaphone
      {...args}
      title="Donate Today"
      body="As a nonprofit, Signal needs your support. As a nonprofit, Signal needs your support. As a nonprofit, Signal needs your support. As a nonprofit, Signal needs your support."
      primaryCtaText="Donate Donate Donate Donate"
      secondaryCtaText="Remind me later Remind me later"
    />
  );
}

export function NarrowSidebar(args: PropsType): React.JSX.Element {
  return <RemoteMegaphone {...args} isFullSize={false} />;
}
