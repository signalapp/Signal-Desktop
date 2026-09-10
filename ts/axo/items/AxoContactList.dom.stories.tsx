// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import { AxoContactList } from './AxoContactList.dom.tsx';
import { FunInlineEmoji } from '../../components/fun/FunEmoji.dom.tsx';
import { Emoji } from '../emoji.std.ts';
import { tw } from '../tw.dom.tsx';
import { AxoAvatar } from '../AxoAvatar.dom.tsx';

export default {
  title: 'Axo/Items/AxoContactList',
} satisfies Meta;

function Avatar(props: { label: string; initials: string }): ReactNode {
  return (
    <AxoAvatar.Root size={32}>
      <AxoAvatar.Content label={props.label}>
        <AxoAvatar.Initials initials={props.initials} color="A100" />
      </AxoAvatar.Content>
    </AxoAvatar.Root>
  );
}

function About(props: { emoji: Emoji.Variant; label: string }): ReactNode {
  return (
    <>
      <FunInlineEmoji
        role="img"
        emoji={props.emoji}
        aria-label={Emoji.getDisplayLabel(props.emoji)}
      />{' '}
      {props.label}
    </>
  );
}

export function Basic(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoContactList.Root>
        <AxoContactList.Item
          avatar={<Avatar label="Jamie's Avatar" initials="JK" />}
          title="Jamie"
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Tyler's Avatar" initials="TN" />}
          title="Tyler"
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Adrian's Avatar" initials="AS" />}
          title="Adrian"
          onClick={action('onClick')}
        />
      </AxoContactList.Root>
    </div>
  );
}

export function Description(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoContactList.Root>
        <AxoContactList.Item
          avatar={<Avatar label="Jamie's Avatar" initials="JK" />}
          title="Jamie"
          description={
            <>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Magni
              ipsum exercitationem est facilis, rerum ea reiciendis tempore sit
              magnam adipisci dolorem hic possimus illo optio ipsam.
              Repudiandae, pariatur saepe. Aperiam.
            </>
          }
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Tyler's Avatar" initials="TN" />}
          title="Tyler"
          description={
            <About
              emoji={Emoji.getDefaultVariant(Emoji.WAVE)}
              label="Speak Freely"
            />
          }
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Adrian's Avatar" initials="AS" />}
          title="Adrian"
          description={<About emoji={Emoji.COFFEE} label="Coffee lover" />}
          onClick={action('onClick')}
        />
      </AxoContactList.Root>
    </div>
  );
}

export function Value(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoContactList.Root>
        <AxoContactList.Item
          avatar={<Avatar label="Jamie's Avatar" initials="JK" />}
          title="Jamie"
          value="Admin"
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Tyler's Avatar" initials="TN" />}
          title="Tyler"
          value="Admin"
          description={
            <About
              emoji={Emoji.getDefaultVariant(Emoji.WAVE)}
              label="Speak Freely"
            />
          }
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Adrian's Avatar" initials="AS" />}
          title="Adrian"
          value="Admin"
          description={
            <>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Magni
              ipsum exercitationem est facilis, rerum ea reiciendis tempore sit
              magnam adipisci dolorem hic possimus illo optio ipsam.
              Repudiandae, pariatur saepe. Aperiam.
            </>
          }
          onClick={action('onClick')}
        />
      </AxoContactList.Root>
    </div>
  );
}

export function ItemActions(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoContactList.Root>
        <AxoContactList.Item
          avatar={<Avatar label="Jamie's Avatar" initials="JK" />}
          title="Jamie"
          onClick={action('onClick')}
          accessory={
            <AxoContactList.ItemAction variant="subtle-secondary">
              Button
            </AxoContactList.ItemAction>
          }
        />
        <AxoContactList.Item
          avatar={<Avatar label="Tyler's Avatar" initials="TN" />}
          title="Tyler"
          description={
            <About
              emoji={Emoji.getDefaultVariant(Emoji.WAVE)}
              label="Speak Freely"
            />
          }
          onClick={action('onClick')}
          accessory={
            <AxoContactList.ItemAction variant="subtle-secondary">
              Button
            </AxoContactList.ItemAction>
          }
        />
        <AxoContactList.Item
          avatar={<Avatar label="Adrian's Avatar" initials="AS" />}
          title="Adrian"
          onClick={action('onClick')}
          accessory={
            <AxoContactList.ItemAction variant="subtle-secondary">
              Button
            </AxoContactList.ItemAction>
          }
        />
      </AxoContactList.Root>
    </div>
  );
}

export function ItemIconActions(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoContactList.Root>
        <AxoContactList.Item
          avatar={<Avatar label="Jamie's Avatar" initials="JK" />}
          title="Jamie"
          onClick={action('onClick')}
          accessory={
            <AxoContactList.ItemIconAction
              variant="implied-secondary"
              symbol="videocamera"
              label="Start video call"
            />
          }
        />
        <AxoContactList.Item
          avatar={<Avatar label="Tyler's Avatar" initials="TN" />}
          title="Tyler"
          description={
            <About
              emoji={Emoji.getDefaultVariant(Emoji.WAVE)}
              label="Speak Freely"
            />
          }
          onClick={action('onClick')}
          accessory={
            <>
              <AxoContactList.ItemIconAction
                variant="implied-secondary"
                symbol="phone"
                label="Start audio call"
              />
              <AxoContactList.ItemIconAction
                variant="implied-secondary"
                symbol="videocamera"
                label="Start video call"
              />
            </>
          }
        />
        <AxoContactList.Item
          avatar={<Avatar label="Adrian's Avatar" initials="AS" />}
          title="Adrian"
          onClick={action('onClick')}
          accessory={
            <AxoContactList.ItemIconAction
              variant="implied-secondary"
              symbol="videocamera"
              label="Start video call"
            />
          }
        />
      </AxoContactList.Root>
    </div>
  );
}

export function ActionItems(): ReactNode {
  return (
    <div className={tw('mx-auto max-w-150')}>
      <AxoContactList.Root>
        <AxoContactList.ActionItem
          symbol="plus"
          title="Add members"
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Jamie's Avatar" initials="JK" />}
          title="Jamie"
          description={<About emoji={Emoji.COFFEE} label="Coffee lover" />}
          onClick={action('onClick')}
        />
        <AxoContactList.Item
          avatar={<Avatar label="Tyler's Avatar" initials="TN" />}
          title="Tyler"
          description={
            <About
              emoji={Emoji.getDefaultVariant(Emoji.WAVE)}
              label="Speak Freely"
            />
          }
          onClick={action('onClick')}
        />
        <AxoContactList.ActionItem
          symbol="chevron-down"
          title="See all"
          onClick={action('onClick')}
        />
      </AxoContactList.Root>
    </div>
  );
}
