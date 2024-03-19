// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { partition } from 'lodash';
import type { ListRowProps } from 'react-virtualized';
import { List } from 'react-virtualized';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/I18N';
import { SearchInput } from './SearchInput';
import { filterAndSortConversations } from '../util/filterAndSortConversations';
import { NavSidebarSearchHeader } from './NavSidebar';
import { ListTile } from './ListTile';
import { strictAssert } from '../util/assert';
import { UserText } from './UserText';
import { Avatar, AvatarSize } from './Avatar';
import { Intl } from './Intl';
import { SizeObserver } from '../hooks/useSizeObserver';
import { CallType } from '../types/CallDisposition';

type CallsNewCallProps = Readonly<{
  hasActiveCall: boolean;
  allConversations: ReadonlyArray<ConversationType>;
  i18n: LocalizerType;
  onSelectConversation: (conversationId: string) => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  regionCode: string | undefined;
}>;

type Row =
  | { kind: 'header'; title: string }
  | { kind: 'conversation'; conversation: ConversationType };

export function CallsNewCallButton({
  callType,
  hasActiveCall,
  onClick,
}: {
  callType: CallType;
  hasActiveCall: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="CallsNewCall__ItemActionButton"
      aria-disabled={hasActiveCall}
      onClick={event => {
        event.stopPropagation();
        if (!hasActiveCall) {
          onClick();
        }
      }}
    >
      {callType === CallType.Audio && (
        <span className="CallsNewCall__ItemIcon CallsNewCall__ItemIcon--Phone" />
      )}
      {callType !== CallType.Audio && (
        <span className="CallsNewCall__ItemIcon CallsNewCall__ItemIcon--Video" />
      )}
    </button>
  );
}

export function CallsNewCall({
  hasActiveCall,
  allConversations,
  i18n,
  onSelectConversation,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  regionCode,
}: CallsNewCallProps): JSX.Element {
  const [queryInput, setQueryInput] = useState('');

  const query = useMemo(() => {
    return queryInput.toLowerCase().normalize().trim();
  }, [queryInput]);

  const activeConversations = useMemo(() => {
    return allConversations.filter(conversation => {
      return conversation.activeAt != null && conversation.isArchived !== true;
    });
  }, [allConversations]);

  const filteredConversations = useMemo(() => {
    if (query === '') {
      return activeConversations;
    }
    return filterAndSortConversations(activeConversations, query, regionCode);
  }, [activeConversations, query, regionCode]);

  const [groupConversations, directConversations] = useMemo(() => {
    return partition(filteredConversations, conversation => {
      return conversation.type === 'group';
    });
  }, [filteredConversations]);

  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQueryInput(event.currentTarget.value);
    },
    []
  );

  const handleSearchInputClear = useCallback(() => {
    setQueryInput('');
  }, []);

  const rows = useMemo((): ReadonlyArray<Row> => {
    let result: Array<Row> = [];
    if (directConversations.length > 0) {
      result.push({
        kind: 'header',
        title: 'Contacts',
      });
      result = result.concat(
        directConversations.map(conversation => {
          return {
            kind: 'conversation',
            conversation,
          };
        })
      );
    }
    if (groupConversations.length > 0) {
      result.push({
        kind: 'header',
        title: 'Groups',
      });
      result = result.concat(
        groupConversations.map((conversation): Row => {
          return {
            kind: 'conversation',
            conversation,
          };
        })
      );
    }
    return result;
  }, [directConversations, groupConversations]);

  const isRowLoaded = useCallback(
    ({ index }) => {
      return rows.at(index) != null;
    },
    [rows]
  );

  const rowHeight = useCallback(
    ({ index }) => {
      if (rows.at(index)?.kind === 'conversation') {
        return ListTile.heightCompact;
      }
      // Height of .CallsNewCall__ListHeaderItem
      return 40;
    },
    [rows]
  );

  const rowRenderer = useCallback(
    ({ key, index, style }: ListRowProps) => {
      const item = rows.at(index);
      strictAssert(item != null, 'Rendered non-existent row');

      if (item.kind === 'header') {
        return (
          <div key={key} style={style} className="CallsNewCall__ListHeaderItem">
            {item.title}
          </div>
        );
      }

      return (
        <div key={key} style={style}>
          <ListTile
            leading={
              <Avatar
                acceptedMessageRequest
                avatarPath={item.conversation.avatarPath}
                conversationType="group"
                i18n={i18n}
                isMe={false}
                title={item.conversation.title}
                sharedGroupNames={[]}
                size={AvatarSize.THIRTY_TWO}
                badge={undefined}
              />
            }
            title={<UserText text={item.conversation.title} />}
            trailing={
              <div className="CallsNewCall__ItemActions">
                {item.conversation.type === 'direct' && (
                  <CallsNewCallButton
                    callType={CallType.Audio}
                    hasActiveCall={hasActiveCall}
                    onClick={() => {
                      onOutgoingAudioCallInConversation(item.conversation.id);
                    }}
                  />
                )}
                <CallsNewCallButton
                  // It's okay if this is a group
                  callType={CallType.Video}
                  hasActiveCall={hasActiveCall}
                  onClick={() => {
                    onOutgoingVideoCallInConversation(item.conversation.id);
                  }}
                />
              </div>
            }
            onClick={() => {
              onSelectConversation(item.conversation.id);
            }}
          />
        </div>
      );
    },
    [
      rows,
      i18n,
      hasActiveCall,
      onSelectConversation,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
    ]
  );

  return (
    <>
      <NavSidebarSearchHeader>
        <SearchInput
          i18n={i18n}
          placeholder="Search"
          onChange={handleSearchInputChange}
          onClear={handleSearchInputClear}
          value={queryInput}
        />
      </NavSidebarSearchHeader>
      {rows.length === 0 && (
        <div className="CallsNewCall__EmptyState">
          {query === '' ? (
            i18n('icu:CallsNewCall__EmptyState--noQuery')
          ) : (
            <Intl
              i18n={i18n}
              id="icu:CallsNewCall__EmptyState--hasQuery"
              components={{
                query: <UserText text={query} />,
              }}
            />
          )}
        </div>
      )}
      {rows.length > 0 && (
        <SizeObserver>
          {(ref, size) => {
            return (
              <div ref={ref} className="CallsNewCall__ListContainer">
                {size != null && (
                  <List
                    className="CallsNewCall__List"
                    width={size.width}
                    height={size.height}
                    isRowLoaded={isRowLoaded}
                    rowCount={rows.length}
                    rowHeight={rowHeight}
                    rowRenderer={rowRenderer}
                  />
                )}
              </div>
            );
          }}
        </SizeObserver>
      )}
    </>
  );
}
