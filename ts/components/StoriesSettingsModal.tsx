// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MeasuredComponentProps } from 'react-measure';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Measure from 'react-measure';
import { noop } from 'lodash';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { Row } from './ConversationList';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { UUIDStringType } from '../types/UUID';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ConversationList, RowType } from './ConversationList';
import { Input } from './Input';
import { Intl } from './Intl';
import { MY_STORIES_ID, getStoryDistributionListName } from '../types/Stories';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';
import { StoryDistributionListName } from './StoryDistributionListName';
import { Theme } from '../util/theme';
import { ThemeType } from '../types/Util';
import { UUID } from '../types/UUID';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';
import { isNotNil } from '../util/isNotNil';
import {
  shouldNeverBeCalled,
  asyncShouldNeverBeCalled,
} from '../util/shouldNeverBeCalled';

export type PropsType = {
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  hideStoriesSettings: () => unknown;
  i18n: LocalizerType;
  me: ConversationType;
  onDeleteList: (listId: string) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  onHideMyStoriesFrom: (viewerUuids: Array<UUIDStringType>) => unknown;
  onRemoveMember: (listId: string, uuid: UUIDStringType | undefined) => unknown;
  onRepliesNReactionsChanged: (
    listId: string,
    allowsReplies: boolean
  ) => unknown;
  onViewersUpdated: (
    listId: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  setMyStoriesToAllSignalConnections: () => unknown;
  toggleSignalConnectionsModal: () => unknown;
};

export enum Page {
  DistributionLists = 'DistributionLists',
  AddViewer = 'AddViewer',
  ChooseViewers = 'ChooseViewers',
  NameStory = 'NameStory',
  HideStoryFrom = 'HideStoryFrom',
}

function filterConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string
) {
  return filterAndSortConversationsByRecent(
    conversations,
    searchTerm,
    undefined
  ).filter(conversation => conversation.uuid);
}

export const StoriesSettingsModal = ({
  candidateConversations,
  distributionLists,
  getPreferredBadge,
  hideStoriesSettings,
  i18n,
  me,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMember,
  onRepliesNReactionsChanged,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  toggleSignalConnectionsModal,
}: PropsType): JSX.Element => {
  const [listToEditId, setListToEditId] = useState<string | undefined>(
    undefined
  );

  const listToEdit = useMemo(
    () => distributionLists.find(x => x.id === listToEditId),
    [distributionLists, listToEditId]
  );

  const [page, setPage] = useState<Page>(Page.DistributionLists);

  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);

  const resetChooseViewersScreen = useCallback(() => {
    setSelectedContacts([]);
    setPage(Page.DistributionLists);
  }, []);

  const [confirmDeleteListId, setConfirmDeleteListId] = useState<
    string | undefined
  >();
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<
    | undefined
    | {
        listId: string;
        title: string;
        uuid: UUIDStringType | undefined;
      }
  >();

  let content: JSX.Element | null;

  if (page !== Page.DistributionLists) {
    content = (
      <EditDistributionList
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onDone={(name, uuids) => {
          onDistributionListCreated(name, uuids);
          resetChooseViewersScreen();
        }}
        onViewersUpdated={uuids => {
          if (listToEditId && page === Page.AddViewer) {
            onViewersUpdated(listToEditId, uuids);
            resetChooseViewersScreen();
          }

          if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          }

          if (page === Page.HideStoryFrom) {
            onHideMyStoriesFrom(uuids);
            resetChooseViewersScreen();
          }
        }}
        page={page}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
      />
    );
  } else if (listToEdit) {
    const isMyStories = listToEdit.id === MY_STORIES_ID;

    content = (
      <>
        {!isMyStories && (
          <>
            <div className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer">
              <span className="StoriesSettingsModal__list__left">
                <span className="StoriesSettingsModal__list__avatar--private" />
                <span className="StoriesSettingsModal__list__title">
                  <StoryDistributionListName
                    i18n={i18n}
                    id={listToEdit.id}
                    name={listToEdit.name}
                  />
                </span>
              </span>
            </div>

            <hr className="StoriesSettingsModal__divider" />
          </>
        )}

        <div className="StoriesSettingsModal__title">
          {i18n('StoriesSettings__who-can-see')}
        </div>

        {isMyStories && (
          <>
            <Checkbox
              checked={!listToEdit.members.length}
              description={i18n('StoriesSettings__mine__all--description')}
              isRadio
              label={i18n('StoriesSettings__mine__all--label')}
              moduleClassName="StoriesSettingsModal__checkbox"
              name="share"
              onChange={() => {
                setMyStoriesToAllSignalConnections();
              }}
            />

            <Checkbox
              checked={listToEdit.isBlockList && listToEdit.members.length > 0}
              description={i18n('StoriesSettings__mine__exclude--description', [
                listToEdit.isBlockList
                  ? String(listToEdit.members.length)
                  : '0',
              ])}
              isRadio
              label={i18n('StoriesSettings__mine__exclude--label')}
              moduleClassName="StoriesSettingsModal__checkbox"
              name="share"
              onChange={noop}
              onClick={() => {
                if (listToEdit.isBlockList) {
                  setSelectedContacts(listToEdit.members);
                }
                setPage(Page.HideStoryFrom);
              }}
            />

            <Checkbox
              checked={!listToEdit.isBlockList && listToEdit.members.length > 0}
              description={
                !listToEdit.isBlockList && listToEdit.members.length
                  ? i18n('StoriesSettings__mine__only--description--people', [
                      String(listToEdit.members.length),
                    ])
                  : i18n('StoriesSettings__mine__only--description')
              }
              isRadio
              label={i18n('StoriesSettings__mine__only--label')}
              moduleClassName="StoriesSettingsModal__checkbox"
              name="share"
              onChange={noop}
              onClick={() => {
                if (!listToEdit.isBlockList) {
                  setSelectedContacts(listToEdit.members);
                }
                setPage(Page.AddViewer);
              }}
            />

            <div className="StoriesSettingsModal__disclaimer">
              <Intl
                components={{
                  learnMore: (
                    <button
                      className="StoriesSettingsModal__disclaimer__learn-more"
                      onClick={toggleSignalConnectionsModal}
                      type="button"
                    >
                      {i18n('StoriesSettings__mine__disclaimer--learn-more')}
                    </button>
                  ),
                }}
                i18n={i18n}
                id="StoriesSettings__mine__disclaimer"
              />
            </div>
          </>
        )}

        {!isMyStories && (
          <>
            <button
              className="StoriesSettingsModal__list"
              onClick={() => {
                setSelectedContacts(listToEdit.members);
                setPage(Page.AddViewer);
              }}
              type="button"
            >
              <span className="StoriesSettingsModal__list__left">
                <span className="StoriesSettingsModal__list__avatar--new" />
                <span className="StoriesSettingsModal__list__title">
                  {i18n('StoriesSettings__add-viewer')}
                </span>
              </span>
            </button>

            {listToEdit.members.map(member => (
              <div
                className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer"
                key={member.id}
              >
                <span className="StoriesSettingsModal__list__left">
                  <Avatar
                    acceptedMessageRequest={member.acceptedMessageRequest}
                    avatarPath={member.avatarPath}
                    badge={getPreferredBadge(member.badges)}
                    color={member.color}
                    conversationType={member.type}
                    i18n={i18n}
                    isMe
                    sharedGroupNames={member.sharedGroupNames}
                    size={AvatarSize.THIRTY_SIX}
                    theme={ThemeType.dark}
                    title={member.title}
                  />
                  <span className="StoriesSettingsModal__list__title">
                    {member.title}
                  </span>
                </span>

                <button
                  aria-label={i18n('StoriesSettings__remove--title', [
                    member.title,
                  ])}
                  className="StoriesSettingsModal__list__delete"
                  onClick={() =>
                    setConfirmRemoveMember({
                      listId: listToEdit.id,
                      title: member.title,
                      uuid: member.uuid,
                    })
                  }
                  type="button"
                />
              </div>
            ))}
          </>
        )}

        <hr className="StoriesSettingsModal__divider" />

        <div className="StoriesSettingsModal__title">
          {i18n('StoriesSettings__replies-reactions--title')}
        </div>

        <Checkbox
          checked={listToEdit.allowsReplies}
          description={i18n('StoriesSettings__replies-reactions--description')}
          label={i18n('StoriesSettings__replies-reactions--label')}
          moduleClassName="StoriesSettingsModal__checkbox"
          name="replies-reactions"
          onChange={value => onRepliesNReactionsChanged(listToEdit.id, value)}
        />

        {!isMyStories && (
          <>
            <hr className="StoriesSettingsModal__divider" />

            <button
              className="StoriesSettingsModal__delete-list"
              onClick={() => setConfirmDeleteListId(listToEdit.id)}
              type="button"
            >
              {i18n('StoriesSettings__delete-list')}
            </button>
          </>
        )}
      </>
    );
  } else {
    const privateStories = distributionLists.filter(
      list => list.id !== MY_STORIES_ID
    );

    content = (
      <>
        <button
          className="StoriesSettingsModal__list"
          onClick={() => {
            setListToEditId(MY_STORIES_ID);
          }}
          type="button"
        >
          <span className="StoriesSettingsModal__list__left">
            <Avatar
              acceptedMessageRequest={me.acceptedMessageRequest}
              avatarPath={me.avatarPath}
              badge={getPreferredBadge(me.badges)}
              color={me.color}
              conversationType={me.type}
              i18n={i18n}
              isMe
              sharedGroupNames={me.sharedGroupNames}
              size={AvatarSize.THIRTY_SIX}
              theme={ThemeType.dark}
              title={me.title}
            />
            <span className="StoriesSettingsModal__list__title">
              {i18n('Stories__mine')}
            </span>
          </span>

          <span className="StoriesSettingsModal__list__viewers" />
        </button>

        <hr className="StoriesSettingsModal__divider" />

        <button
          className="StoriesSettingsModal__list"
          onClick={() => {
            setPage(Page.ChooseViewers);
          }}
          type="button"
        >
          <span className="StoriesSettingsModal__list__left">
            <span className="StoriesSettingsModal__list__avatar--new" />
            <span className="StoriesSettingsModal__list__title">
              {i18n('StoriesSettings__new-list')}
            </span>
          </span>
        </button>
        {privateStories.map(list => (
          <button
            className="StoriesSettingsModal__list"
            key={list.id}
            onClick={() => {
              setListToEditId(list.id);
            }}
            type="button"
          >
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--private" />
              <span className="StoriesSettingsModal__list__title">
                {list.name}
              </span>
            </span>

            <span className="StoriesSettingsModal__list__viewers">
              {list.members.length === 1
                ? i18n('StoriesSettings__viewers--singular', ['1'])
                : i18n('StoriesSettings__viewers--plural', [
                    String(list.members.length),
                  ])}
            </span>
          </button>
        ))}
      </>
    );
  }

  const isChoosingViewers =
    page === Page.ChooseViewers || page === Page.AddViewer;

  let modalTitle: string = i18n('StoriesSettings__title');
  if (page === Page.HideStoryFrom) {
    modalTitle = i18n('StoriesSettings__hide-story');
  } else if (page === Page.NameStory) {
    modalTitle = i18n('StoriesSettings__name-story');
  } else if (isChoosingViewers) {
    modalTitle = i18n('StoriesSettings__choose-viewers');
  } else if (listToEdit) {
    modalTitle = getStoryDistributionListName(
      i18n,
      listToEdit.id,
      listToEdit.name
    );
  }

  const hasBackButton = page !== Page.DistributionLists || listToEdit;
  const hasStickyButtons =
    isChoosingViewers || page === Page.NameStory || page === Page.HideStoryFrom;

  return (
    <>
      <Modal
        hasStickyButtons={hasStickyButtons}
        hasXButton
        i18n={i18n}
        moduleClassName="StoriesSettingsModal__modal"
        onBackButtonClick={
          hasBackButton
            ? () => {
                if (page === Page.HideStoryFrom) {
                  resetChooseViewersScreen();
                } else if (page === Page.NameStory) {
                  setPage(Page.ChooseViewers);
                } else if (isChoosingViewers) {
                  resetChooseViewersScreen();
                } else if (listToEdit) {
                  setListToEditId(undefined);
                }
              }
            : undefined
        }
        onClose={hideStoriesSettings}
        theme={Theme.Dark}
        title={modalTitle}
      >
        {content}
      </Modal>
      {confirmDeleteListId && (
        <ConfirmationDialog
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteListId);
                setListToEditId(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteListId(undefined);
          }}
        >
          {i18n('StoriesSettings__delete-list--confirm')}
        </ConfirmationDialog>
      )}
      {confirmRemoveMember && (
        <ConfirmationDialog
          actions={[
            {
              action: () =>
                onRemoveMember(
                  confirmRemoveMember.listId,
                  confirmRemoveMember.uuid
                ),
              style: 'negative',
              text: i18n('StoriesSettings__remove--action'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveMember(undefined);
          }}
          title={i18n('StoriesSettings__remove--title', [
            confirmRemoveMember.title,
          ])}
        >
          {i18n('StoriesSettings__remove--body')}
        </ConfirmationDialog>
      )}
    </>
  );
};

type EditDistributionListPropsType = {
  onDone: (name: string, viewerUuids: Array<UUIDStringType>) => unknown;
  onViewersUpdated: (viewerUuids: Array<UUIDStringType>) => unknown;
  page: Page;
  selectedContacts: Array<ConversationType>;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
} & Pick<PropsType, 'candidateConversations' | 'getPreferredBadge' | 'i18n'>;

export const EditDistributionList = ({
  candidateConversations,
  getPreferredBadge,
  i18n,
  onDone,
  onViewersUpdated,
  page,
  selectedContacts,
  setSelectedContacts,
}: EditDistributionListPropsType): JSX.Element | null => {
  const [storyName, setStoryName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearchTerm = searchTerm.trim();

  const [filteredConversations, setFilteredConversations] = useState(
    filterConversations(candidateConversations, normalizedSearchTerm)
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterConversations(candidateConversations, normalizedSearchTerm)
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [candidateConversations, normalizedSearchTerm, setFilteredConversations]);

  const isEditingDistributionList =
    page === Page.AddViewer ||
    page === Page.ChooseViewers ||
    page === Page.NameStory ||
    page === Page.HideStoryFrom;

  useEffect(() => {
    if (!isEditingDistributionList) {
      setSearchTerm('');
    }
  }, [isEditingDistributionList]);

  const contactLookup = useMemo(() => {
    const map = new Map();
    candidateConversations.forEach(contact => {
      map.set(contact.id, contact);
    });
    return map;
  }, [candidateConversations]);

  const selectedConversationUuids: Set<UUIDStringType> = useMemo(
    () =>
      new Set(selectedContacts.map(contact => contact.uuid).filter(isNotNil)),
    [selectedContacts]
  );

  const toggleSelectedConversation = useCallback(
    (conversationId: string) => {
      let removeContact = false;
      const nextSelectedContacts = selectedContacts.filter(contact => {
        if (contact.id === conversationId) {
          removeContact = true;
          return false;
        }
        return true;
      });
      if (removeContact) {
        setSelectedContacts(nextSelectedContacts);
        return;
      }
      const selectedContact = contactLookup.get(conversationId);
      if (selectedContact) {
        setSelectedContacts([...nextSelectedContacts, selectedContact]);
      }
    },
    [contactLookup, selectedContacts, setSelectedContacts]
  );

  const isChoosingViewers =
    page === Page.ChooseViewers || page === Page.AddViewer;

  if (page === Page.NameStory) {
    return (
      <>
        <div className="StoriesSettingsModal__name-story-avatar-container">
          <div className="StoriesSettingsModal__list__avatar--private StoriesSettingsModal__list__avatar--private--large" />
        </div>

        <Input
          i18n={i18n}
          onChange={setStoryName}
          placeholder={i18n('StoriesSettings__name-placeholder')}
          value={storyName}
        />

        <div className="StoriesSettingsModal__title">
          {i18n('StoriesSettings__who-can-see')}
        </div>

        {selectedContacts.map(contact => (
          <div
            className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer"
            key={contact.id}
          >
            <span className="StoriesSettingsModal__list__left">
              <Avatar
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarPath={contact.avatarPath}
                badge={getPreferredBadge(contact.badges)}
                color={contact.color}
                conversationType={contact.type}
                i18n={i18n}
                isMe
                sharedGroupNames={contact.sharedGroupNames}
                size={AvatarSize.THIRTY_SIX}
                theme={ThemeType.dark}
                title={contact.title}
              />
              <span className="StoriesSettingsModal__list__title">
                {contact.title}
              </span>
            </span>
          </div>
        ))}
        <Modal.ButtonFooter>
          <Button
            disabled={!storyName}
            onClick={() => {
              onDone(storyName, Array.from(selectedConversationUuids));
              setStoryName('');
            }}
            variant={ButtonVariant.Primary}
          >
            {i18n('done')}
          </Button>
        </Modal.ButtonFooter>
      </>
    );
  }

  if (
    page === Page.AddViewer ||
    page === Page.ChooseViewers ||
    page === Page.HideStoryFrom
  ) {
    const rowCount = filteredConversations.length;
    const getRow = (index: number): undefined | Row => {
      const contact = filteredConversations[index];
      if (!contact || !contact.uuid) {
        return undefined;
      }

      const isSelected = selectedConversationUuids.has(UUID.cast(contact.uuid));

      return {
        type: RowType.ContactCheckbox,
        contact,
        isChecked: isSelected,
      };
    };

    return (
      <>
        <SearchInput
          disabled={candidateConversations.length === 0}
          i18n={i18n}
          placeholder={i18n('contactSearchPlaceholder')}
          moduleClassName="StoriesSettingsModal__search"
          onChange={event => {
            setSearchTerm(event.target.value);
          }}
          value={searchTerm}
        />
        {selectedContacts.length ? (
          <div className="StoriesSettingsModal__tags">
            {selectedContacts.map(contact => (
              <div className="StoriesSettingsModal__tag" key={contact.id}>
                <Avatar
                  acceptedMessageRequest={contact.acceptedMessageRequest}
                  avatarPath={contact.avatarPath}
                  badge={getPreferredBadge(contact.badges)}
                  color={contact.color}
                  conversationType={contact.type}
                  i18n={i18n}
                  isMe={contact.isMe}
                  sharedGroupNames={contact.sharedGroupNames}
                  size={AvatarSize.TWENTY_EIGHT}
                  theme={ThemeType.dark}
                  title={contact.title}
                />
                <span className="StoriesSettingsModal__tag__name">
                  {contact.firstName ||
                    contact.profileName ||
                    contact.phoneNumber}
                </span>
                <button
                  aria-label={i18n('StoriesSettings__remove--title', [
                    contact.title,
                  ])}
                  className="StoriesSettingsModal__tag__remove"
                  onClick={() => toggleSelectedConversation(contact.id)}
                  type="button"
                />
              </div>
            ))}
          </div>
        ) : undefined}
        {candidateConversations.length ? (
          <Measure bounds>
            {({ contentRect, measureRef }: MeasuredComponentProps) => (
              <div
                className="StoriesSettingsModal__conversation-list"
                ref={measureRef}
              >
                <ConversationList
                  dimensions={contentRect.bounds}
                  getPreferredBadge={getPreferredBadge}
                  getRow={getRow}
                  i18n={i18n}
                  onClickArchiveButton={shouldNeverBeCalled}
                  onClickContactCheckbox={(conversationId: string) => {
                    toggleSelectedConversation(conversationId);
                  }}
                  lookupConversationWithoutUuid={asyncShouldNeverBeCalled}
                  showConversation={shouldNeverBeCalled}
                  showUserNotFoundModal={shouldNeverBeCalled}
                  setIsFetchingUUID={shouldNeverBeCalled}
                  onSelectConversation={shouldNeverBeCalled}
                  renderMessageSearchResult={() => {
                    shouldNeverBeCalled();
                    return <div />;
                  }}
                  rowCount={rowCount}
                  shouldRecomputeRowHeights={false}
                  showChooseGroupMembers={shouldNeverBeCalled}
                  theme={ThemeType.dark}
                />
              </div>
            )}
          </Measure>
        ) : (
          <div className="module-ForwardMessageModal__no-candidate-contacts">
            {i18n('noContactsFound')}
          </div>
        )}
        {isChoosingViewers && (
          <Modal.ButtonFooter>
            <Button
              disabled={selectedContacts.length === 0}
              onClick={() => {
                onViewersUpdated(Array.from(selectedConversationUuids));
              }}
              variant={ButtonVariant.Primary}
            >
              {page === Page.AddViewer ? i18n('done') : i18n('next2')}
            </Button>
          </Modal.ButtonFooter>
        )}
        {page === Page.HideStoryFrom && (
          <Modal.ButtonFooter>
            <Button
              disabled={selectedContacts.length === 0}
              onClick={() => {
                onViewersUpdated(Array.from(selectedConversationUuids));
              }}
              variant={ButtonVariant.Primary}
            >
              {i18n('update')}
            </Button>
          </Modal.ButtonFooter>
        )}
      </>
    );
  }

  return null;
};
