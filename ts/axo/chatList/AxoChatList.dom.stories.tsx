// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import { AxoChatList } from './AxoChatList.dom.tsx';
import { AxoChatItem } from './AxoChatItem.dom.tsx';
import { AxoChatItemCompact } from './AxoChatItemCompact.dom.tsx';
import { AriaList } from '../aria/AriaList.dom.tsx';
import { AxoAvatar } from '../AxoAvatar.dom.tsx';
import { AxoTokens } from '../AxoTokens.std.ts';
import type { AxoOutgoingStatus } from '../message/AxoOutgoingStatus.dom.tsx';
import { AxoBaseSpinner } from '../status/_AxoBaseSpinner.dom.tsx';
import { tw } from '../tw.dom.tsx';

export default {
  title: 'Axo/ChatList/AxoChatList',
} satisfies Meta;

type Chat = Readonly<{
  id: string;
  name: string;
  initials: string;
  sender: string | null;
  outgoingStatus: AxoOutgoingStatus.Status | null;
  preview: string;
  time: string;
  unreadCount: number;
  markedUnread: boolean;
  mentioned: boolean;
  muted: boolean;
}>;

const NAMES = [
  'Alice Ahn',
  'Bob Baker',
  'Carol Chen',
  'Book Club',
  'Dan Diaz',
  'Erin Evans',
  'Family',
  'Frank Fu',
];

const PREVIEWS = [
  'Message preview',
  'Are we still on for tomorrow?',
  'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Magni ipsum exercitationem est facilis, rerum ea reiciendis tempore sit magnam.',
  'Sounds good',
];

function getChat(index: number): Chat {
  const name = NAMES[index % NAMES.length] ?? '';
  return {
    id: `chat-${index}`,
    name,
    initials: name
      .split(' ')
      .map(part => part[0])
      .join(''),
    sender: index % 3 === 0 ? 'Sender' : null,
    outgoingStatus: index % 4 === 2 ? 'read' : null,
    preview: PREVIEWS[index % PREVIEWS.length] ?? '',
    time: '11:00 AM',
    unreadCount: index % 5 === 1 ? index : 0,
    markedUnread: index % 6 === 2,
    mentioned: index % 10 === 1,
    muted: index % 7 === 3,
  };
}

function ChatAvatar(props: { chat: Chat; size: AxoAvatar.Size }): ReactNode {
  const { chat } = props;
  return (
    <AxoAvatar.Root size={props.size}>
      <AxoAvatar.Content label={null}>
        <AxoAvatar.Initials
          initials={chat.initials}
          color={AxoTokens.Avatar.getColorNameByHash(chat.name.length)}
        />
      </AxoAvatar.Content>
    </AxoAvatar.Root>
  );
}

function FullChatItem(props: { chat: Chat }): ReactNode {
  const { chat } = props;
  return (
    <AriaList.Item asChild>
      <AxoChatItem.Root>
        <AxoChatItem.Avatar>
          <ChatAvatar chat={chat} size={48} />
        </AxoChatItem.Avatar>
        <AxoChatItem.Content>
          <AxoChatItem.Label>{chat.name}</AxoChatItem.Label>
          {chat.muted && (
            <AxoChatItem.LabelIcon symbol="bell-slash" label="Muted" />
          )}
          <AxoChatItem.Timestamp timestamp={0}>
            {chat.time}
          </AxoChatItem.Timestamp>
          <AxoChatItem.Description>
            {chat.sender != null && (
              <span className={tw('font-semibold text-primary')}>
                {chat.sender}:{' '}
              </span>
            )}
            {chat.preview}
          </AxoChatItem.Description>
          {chat.outgoingStatus != null && (
            <AxoChatItem.OutgoingStatus
              status={chat.outgoingStatus}
              label={null}
            />
          )}
          <AxoChatItem.Badges
            unreadCount={chat.unreadCount}
            markedUnread={chat.markedUnread}
            mentioned={chat.mentioned}
          />
        </AxoChatItem.Content>
        <AxoChatItem.HiddenTrigger
          label={`${chat.name}, ${chat.preview}`}
          onClick={() => action('onClick')(chat.id)}
        />
      </AxoChatItem.Root>
    </AriaList.Item>
  );
}

function CompactChatItem(props: { chat: Chat }): ReactNode {
  const { chat } = props;
  return (
    <AriaList.Item asChild>
      <AxoChatItemCompact.Root>
        <AxoChatItemCompact.Avatar>
          <ChatAvatar chat={chat} size={40} />
          <AxoChatItemCompact.Badges
            unreadCount={chat.unreadCount}
            markedUnread={chat.markedUnread}
            mentioned={chat.mentioned}
          />
        </AxoChatItemCompact.Avatar>
        <AxoChatItemCompact.HiddenTrigger
          label={`${chat.name}, ${chat.preview}`}
          onClick={() => action('onClick')(chat.id)}
        />
      </AxoChatItemCompact.Root>
    </AriaList.Item>
  );
}

function ChatItem(props: { compact: boolean; chat: Chat }): ReactNode {
  const { compact, chat } = props;
  if (compact) {
    return <CompactChatItem chat={chat} />;
  }
  return <FullChatItem chat={chat} />;
}

function ArchivedItem(props: { compact: boolean }): ReactNode {
  const { compact } = props;

  if (compact) {
    return (
      <AriaList.Item asChild>
        <AxoChatItemCompact.Root>
          <AxoChatItemCompact.Avatar>
            <AxoChatItemCompact.IconAvatar symbol="archive" />
          </AxoChatItemCompact.Avatar>
          <AxoChatItemCompact.HiddenTrigger
            label="Archived Chats, 5 chats"
            onClick={action('onClickArchived')}
          />
        </AxoChatItemCompact.Root>
      </AriaList.Item>
    );
  }

  return (
    <AriaList.Item asChild>
      <AxoChatItem.Root>
        <AxoChatItem.Avatar>
          <AxoChatItem.IconAvatar symbol="archive" />
        </AxoChatItem.Avatar>
        <AxoChatItem.Content>
          <AxoChatItem.Label>Archived Chats</AxoChatItem.Label>
        </AxoChatItem.Content>
        <AxoChatItem.Count count={5} label="5 archived chats" />
        <AxoChatItem.HiddenTrigger
          label="View archived chats"
          onClick={action('onClickArchived')}
        />
      </AxoChatItem.Root>
    </AriaList.Item>
  );
}

function Sidebar(props: { compact: boolean; children: ReactNode }) {
  const { compact, children } = props;
  return (
    <div
      className={tw(
        'rounded-2xl bg-surface-secondary py-2',
        compact ? 'w-20' : 'w-80'
      )}
    >
      {children}
    </div>
  );
}

function AllStatesTemplate(props: { compact: boolean }): ReactNode {
  const { compact } = props;
  return (
    <Sidebar compact={compact}>
      <AriaList.Root asChild label="Chats">
        <AxoChatList.Root compact={compact}>
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), sender: 'Sender' }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), sender: 'Sender', unreadCount: 5 }}
          />
          <ChatItem
            compact={compact}
            chat={{
              ...getChat(0),
              sender: 'Sender',
              unreadCount: 3,
              mentioned: true,
              muted: true,
            }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), markedUnread: true, mentioned: true }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), outgoingStatus: 'sending' }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), outgoingStatus: 'sent' }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), outgoingStatus: 'delivered' }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), outgoingStatus: 'read' }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), outgoingStatus: 'paused' }}
          />
          <ChatItem
            compact={compact}
            chat={{ ...getChat(0), outgoingStatus: 'error' }}
          />
          <ArchivedItem compact={compact} />
        </AxoChatList.Root>
      </AriaList.Root>
    </Sidebar>
  );
}

function GroupsTemplate(props: { compact: boolean }): ReactNode {
  const { compact } = props;
  return (
    <Sidebar compact={compact}>
      <AriaList.Root asChild>
        <AxoChatList.Root compact={compact}>
          <AriaList.Item asChild>
            <AxoChatList.Group>
              <AriaList.Label asChild>
                <AxoChatList.Label>Pinned</AxoChatList.Label>
              </AriaList.Label>
              <AriaList.Group>
                <ChatItem compact={compact} chat={getChat(0)} />
                <ChatItem compact={compact} chat={getChat(1)} />
              </AriaList.Group>
            </AxoChatList.Group>
          </AriaList.Item>
          <AriaList.Item asChild>
            <AxoChatList.Group>
              <AriaList.Label asChild>
                <AxoChatList.Label>Chats</AxoChatList.Label>
              </AriaList.Label>
              <AriaList.Group>
                <ChatItem compact={compact} chat={getChat(2)} />
                <ChatItem compact={compact} chat={getChat(3)} />
              </AriaList.Group>
            </AxoChatList.Group>
          </AriaList.Item>
        </AxoChatList.Root>
      </AriaList.Root>
    </Sidebar>
  );
}

export function AllStates(): ReactNode {
  return <AllStatesTemplate compact={false} />;
}

export function AllStatesCompact(): ReactNode {
  return <AllStatesTemplate compact />;
}

export function Groups(): ReactNode {
  return <GroupsTemplate compact={false} />;
}

export function GroupsCompact(): ReactNode {
  return <GroupsTemplate compact />;
}

export function Loading(): ReactNode {
  return (
    <Sidebar compact={false}>
      <AxoChatList.LoadingState>
        <AxoBaseSpinner.Root
          size={24}
          weight="regular"
          variant="default"
          value="indeterminate"
          track={false}
        />
      </AxoChatList.LoadingState>
    </Sidebar>
  );
}

export function Empty(): ReactNode {
  return (
    <Sidebar compact={false}>
      <AxoChatList.EmptyState>No results for “xyz”</AxoChatList.EmptyState>
    </Sidebar>
  );
}
