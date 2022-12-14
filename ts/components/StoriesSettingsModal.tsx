// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MeasuredComponentProps } from 'react-measure';
import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Measure from 'react-measure';
import { noop } from 'lodash';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { Row } from './ConversationList';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { UUIDStringType } from '../types/UUID';
import type { RenderModalPage, ModalPropsType } from './Modal';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContactPills } from './ContactPills';
import { ContactPill } from './ContactPill';
import { ConversationList, RowType } from './ConversationList';
import { Input } from './Input';
import { Intl } from './Intl';
import { MY_STORY_ID, getStoryDistributionListName } from '../types/Stories';
import { PagedModal, ModalPage } from './Modal';
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
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { getGroupMemberships } from '../util/getGroupMemberships';
import { strictAssert } from '../util/assert';

export type PropsType = {
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  groupStories: Array<ConversationType>;
  signalConnections: Array<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  hideStoriesSettings: () => unknown;
  i18n: LocalizerType;
  me: ConversationType;
  onDeleteList: (listId: string) => unknown;
  toggleGroupsForStorySend: (groupIds: Array<string>) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerUuids: Array<UUIDStringType>
  ) => Promise<string>;
  onHideMyStoriesFrom: (viewerUuids: Array<UUIDStringType>) => unknown;
  onRemoveMembers: (listId: string, uuids: Array<UUIDStringType>) => unknown;
  onRepliesNReactionsChanged: (
    listId: string,
    allowsReplies: boolean
  ) => unknown;
  onViewersUpdated: (
    listId: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  setMyStoriesToAllSignalConnections: () => unknown;
  storyViewReceiptsEnabled: boolean;
  toggleSignalConnectionsModal: () => unknown;
  toggleStoriesView: () => void;
  setStoriesDisabled: (value: boolean) => void;
  getConversationByUuid: (uuid: UUIDStringType) => ConversationType | undefined;
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

const modalCommonProps: Pick<ModalPropsType, 'hasXButton' | 'moduleClassName'> =
  {
    hasXButton: true,
    moduleClassName: 'StoriesSettingsModal__modal',
  };

export function getListViewers(
  list: StoryDistributionListWithMembersDataType,
  i18n: LocalizerType,
  signalConnections: Array<ConversationType>
): string {
  let memberCount = list.members.length;

  if (list.id === MY_STORY_ID && list.isBlockList) {
    memberCount = list.isBlockList
      ? signalConnections.length - list.members.length
      : signalConnections.length;
  }

  return i18n('icu:StoriesSettings__viewers', { count: memberCount });
}

export function getI18nForMyStory(
  list: StoryDistributionListWithMembersDataType,
  i18n: LocalizerType
): string {
  if (list.members.length === 0) {
    return i18n('StoriesSettings__mine__all--label');
  }

  if (!list.isBlockList) {
    return i18n('SendStoryModal__only-share-with');
  }

  return i18n('StoriesSettings__mine__all--label');
}

type DistributionListItemProps = {
  i18n: LocalizerType;
  distributionList: StoryDistributionListWithMembersDataType;
  me: ConversationType;
  signalConnections: Array<ConversationType>;
  onSelectItemToEdit(id: UUIDStringType): void;
};

function DistributionListItem({
  i18n,
  distributionList,
  me,
  signalConnections,
  onSelectItemToEdit,
}: DistributionListItemProps) {
  const isMyStory = distributionList.id === MY_STORY_ID;
  return (
    <button
      className="StoriesSettingsModal__list"
      onClick={() => {
        onSelectItemToEdit(distributionList.id);
      }}
      type="button"
    >
      <span className="StoriesSettingsModal__list__left">
        {isMyStory ? (
          <Avatar
            acceptedMessageRequest={me.acceptedMessageRequest}
            avatarPath={me.avatarPath}
            badge={undefined}
            color={me.color}
            conversationType={me.type}
            i18n={i18n}
            isMe
            sharedGroupNames={me.sharedGroupNames}
            size={AvatarSize.THIRTY_TWO}
            title={me.title}
          />
        ) : (
          <span className="StoriesSettingsModal__list__avatar--custom" />
        )}
        <span className="StoriesSettingsModal__list__title">
          <StoryDistributionListName
            i18n={i18n}
            id={distributionList.id}
            name={distributionList.name}
          />
          <span className="StoriesSettingsModal__list__viewers">
            {isMyStory
              ? getI18nForMyStory(distributionList, i18n)
              : i18n('icu:StoriesSettings__custom-story-subtitle')}
            &nbsp;&middot;&nbsp;
            {getListViewers(distributionList, i18n, signalConnections)}
          </span>
        </span>
      </span>
    </button>
  );
}

type GroupStoryItemProps = {
  i18n: LocalizerType;
  groupStory: ConversationType;
  onSelectGroupToView(id: string): void;
};

function GroupStoryItem({
  i18n,
  groupStory,
  onSelectGroupToView,
}: GroupStoryItemProps) {
  return (
    <button
      className="StoriesSettingsModal__list"
      onClick={() => {
        onSelectGroupToView(groupStory.id);
      }}
      type="button"
    >
      <span className="StoriesSettingsModal__list__left">
        <Avatar
          acceptedMessageRequest={groupStory.acceptedMessageRequest}
          avatarPath={groupStory.avatarPath}
          badge={undefined}
          color={groupStory.color}
          conversationType={groupStory.type}
          i18n={i18n}
          isMe={false}
          sharedGroupNames={[]}
          size={AvatarSize.THIRTY_TWO}
          title={groupStory.title}
        />
        <span className="StoriesSettingsModal__list__title">
          {groupStory.title}
          <span className="StoriesSettingsModal__list__viewers">
            {i18n('icu:StoriesSettings__group-story-subtitle')}
            &nbsp;&middot;&nbsp;
            {i18n('icu:StoriesSettings__viewers', {
              count: groupStory.membersCount,
            })}
          </span>
        </span>
      </span>
    </button>
  );
}

export function StoriesSettingsModal({
  candidateConversations,
  distributionLists,
  groupStories,
  signalConnections,
  getPreferredBadge,
  hideStoriesSettings,
  i18n,
  me,
  onDeleteList,
  toggleGroupsForStorySend,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  storyViewReceiptsEnabled,
  toggleSignalConnectionsModal,
  toggleStoriesView,
  setStoriesDisabled,
  getConversationByUuid,
}: PropsType): JSX.Element {
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard(i18n);

  const [listToEditId, setListToEditId] = useState<string | undefined>(
    undefined
  );

  const listToEdit = useMemo(
    () => distributionLists.find(x => x.id === listToEditId),
    [distributionLists, listToEditId]
  );

  const [groupToViewId, setGroupToViewId] = useState<string | null>(null);
  const groupToView = useMemo(() => {
    return groupStories.find(group => {
      return group.id === groupToViewId;
    });
  }, [groupStories, groupToViewId]);

  const [page, setPage] = useState<Page>(Page.DistributionLists);

  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);

  const resetChooseViewersScreen = useCallback(() => {
    setSelectedContacts([]);
    setPage(Page.DistributionLists);
  }, []);

  const [confirmDeleteList, setConfirmDeleteList] = useState<
    { id: string; name: string } | undefined
  >();

  const [confirmRemoveGroup, setConfirmRemoveGroup] = useState<{
    id: string;
    title: string;
  } | null>(null);

  let modal: RenderModalPage | null;

  if (page !== Page.DistributionLists) {
    const isChoosingViewers =
      page === Page.ChooseViewers || page === Page.AddViewer;

    modal = onClose => (
      <EditDistributionListModal
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        page={page}
        onClose={onClose}
        onCreateList={(name, uuids) => {
          onDistributionListCreated(name, uuids);
          resetChooseViewersScreen();
        }}
        onBackButtonClick={() =>
          confirmDiscardIf(selectedContacts.length > 0, () => {
            if (page === Page.HideStoryFrom) {
              resetChooseViewersScreen();
            } else if (page === Page.NameStory) {
              setPage(Page.ChooseViewers);
            } else if (isChoosingViewers) {
              resetChooseViewersScreen();
            } else if (listToEdit) {
              setListToEditId(undefined);
            } else if (groupToView) {
              setGroupToViewId(null);
            }
          })
        }
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
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
      />
    );
  } else if (listToEdit) {
    modal = handleClose => (
      <DistributionListSettingsModal
        key="settings-modal"
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        listToEdit={listToEdit}
        signalConnectionsCount={signalConnections.length}
        onRemoveMembers={onRemoveMembers}
        onRepliesNReactionsChanged={onRepliesNReactionsChanged}
        setConfirmDeleteList={setConfirmDeleteList}
        setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
        setPage={setPage}
        setSelectedContacts={setSelectedContacts}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        onBackButtonClick={() => setListToEditId(undefined)}
        onClose={handleClose}
      />
    );
  } else if (groupToView) {
    modal = onClose => (
      <GroupStorySettingsModal
        i18n={i18n}
        group={groupToView}
        onClose={onClose}
        onBackButtonClick={() => setGroupToViewId(null)}
        getConversationByUuid={getConversationByUuid}
        onRemoveGroup={group => {
          setConfirmRemoveGroup({
            id: group.id,
            title: group.title,
          });
        }}
      />
    );
  } else {
    modal = onClose => (
      <ModalPage
        modalName="StoriesSettingsModal__list"
        i18n={i18n}
        onClose={onClose}
        title={i18n('StoriesSettings__title')}
        {...modalCommonProps}
      >
        <p className="StoriesSettingsModal__description">
          {i18n('icu:StoriesSettings__description')}
        </p>

        <div className="StoriesSettingsModal__listHeader">
          <h2 className="StoriesSettingsModal__listHeader__title">
            {i18n('icu:StoriesSettings__my_stories')}
          </h2>
        </div>

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

        {distributionLists.map(distributionList => {
          return (
            <DistributionListItem
              key={distributionList.id}
              i18n={i18n}
              me={me}
              distributionList={distributionList}
              signalConnections={signalConnections}
              onSelectItemToEdit={setListToEditId}
            />
          );
        })}

        {groupStories.map(groupStory => {
          return (
            <GroupStoryItem
              key={groupStory.id}
              i18n={i18n}
              groupStory={groupStory}
              onSelectGroupToView={setGroupToViewId}
            />
          );
        })}

        <hr className="StoriesSettingsModal__divider" />

        <Checkbox
          disabled
          checked={storyViewReceiptsEnabled}
          description={i18n('StoriesSettings__view-receipts--description')}
          label={i18n('StoriesSettings__view-receipts--label')}
          moduleClassName="StoriesSettingsModal__checkbox"
          name="view-receipts"
          onChange={noop}
        />

        <div className="StoriesSettingsModal__stories-off-container">
          <p className="StoriesSettingsModal__stories-off-text">
            {i18n('Stories__settings-toggle--description')}
          </p>
          <Button
            className="Preferences__stories-off"
            variant={ButtonVariant.SecondaryDestructive}
            onClick={async () => {
              setStoriesDisabled(true);
              toggleStoriesView();
              onClose();
            }}
          >
            {i18n('Stories__settings-toggle--button')}
          </Button>
        </div>
      </ModalPage>
    );
  }

  return (
    <>
      {!confirmDiscardModal && (
        <PagedModal
          modalName="StoriesSettingsModal"
          moduleClassName="StoriesSettingsModal"
          theme={Theme.Dark}
          onClose={() =>
            confirmDiscardIf(selectedContacts.length > 0, hideStoriesSettings)
          }
        >
          {modal}
        </PagedModal>
      )}
      {confirmDeleteList && (
        <ConfirmationDialog
          dialogName="StoriesSettings.deleteList"
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteList.id);
                setListToEditId(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteList(undefined);
          }}
          theme={Theme.Dark}
        >
          {i18n('StoriesSettings__delete-list--confirm', [
            confirmDeleteList.name,
          ])}
        </ConfirmationDialog>
      )}
      {confirmRemoveGroup != null && (
        <ConfirmationDialog
          dialogName="StoriesSettings.removeGroupStory"
          actions={[
            {
              action: () => {
                toggleGroupsForStorySend([confirmRemoveGroup.id]);
                setConfirmRemoveGroup(null);
                setGroupToViewId(null);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveGroup(null);
          }}
          theme={Theme.Dark}
        >
          {i18n('icu:StoriesSettings__remove_group--confirm', {
            groupTitle: confirmRemoveGroup.title,
          })}
        </ConfirmationDialog>
      )}
      {confirmDiscardModal}
    </>
  );
}

type DistributionListSettingsModalPropsType = {
  i18n: LocalizerType;
  listToEdit: StoryDistributionListWithMembersDataType;
  signalConnectionsCount: number;
  setConfirmDeleteList: (_: { id: string; name: string }) => unknown;
  setPage: (page: Page) => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  onBackButtonClick: (() => void) | undefined;
  onClose: () => void;
} & Pick<
  PropsType,
  | 'getPreferredBadge'
  | 'onRemoveMembers'
  | 'onRepliesNReactionsChanged'
  | 'setMyStoriesToAllSignalConnections'
  | 'toggleSignalConnectionsModal'
>;

export function DistributionListSettingsModal({
  getPreferredBadge,
  i18n,
  listToEdit,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onBackButtonClick,
  onClose,
  setConfirmDeleteList,
  setMyStoriesToAllSignalConnections,
  setPage,
  setSelectedContacts,
  toggleSignalConnectionsModal,
  signalConnectionsCount,
}: DistributionListSettingsModalPropsType): JSX.Element {
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<
    | undefined
    | {
        listId: string;
        title: string;
        uuid: UUIDStringType;
      }
  >();

  const isMyStory = listToEdit.id === MY_STORY_ID;

  const modalTitle = getStoryDistributionListName(
    i18n,
    listToEdit.id,
    listToEdit.name
  );

  return (
    <ModalPage
      modalName="DistributionListSettingsModal"
      i18n={i18n}
      onBackButtonClick={onBackButtonClick}
      onClose={onClose}
      title={modalTitle}
      {...modalCommonProps}
    >
      {!isMyStory && (
        <>
          <div className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer">
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--custom" />
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

      {isMyStory && (
        <EditMyStoryPrivacy
          i18n={i18n}
          learnMore="StoriesSettings__mine__disclaimer"
          myStories={listToEdit}
          onClickExclude={() => {
            setPage(Page.HideStoryFrom);
          }}
          onClickOnlyShareWith={() => {
            setPage(Page.AddViewer);
          }}
          setSelectedContacts={setSelectedContacts}
          setMyStoriesToAllSignalConnections={
            setMyStoriesToAllSignalConnections
          }
          toggleSignalConnectionsModal={toggleSignalConnectionsModal}
          signalConnectionsCount={signalConnectionsCount}
        />
      )}

      {!isMyStory && (
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
                  size={AvatarSize.THIRTY_TWO}
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
                onClick={() => {
                  strictAssert(member.uuid, 'Story member was missing uuid');
                  setConfirmRemoveMember({
                    listId: listToEdit.id,
                    title: member.title,
                    uuid: member.uuid,
                  });
                }}
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

      {!isMyStory && (
        <>
          <hr className="StoriesSettingsModal__divider" />

          <button
            className="StoriesSettingsModal__delete-list"
            onClick={() => setConfirmDeleteList(listToEdit)}
            type="button"
          >
            {i18n('StoriesSettings__delete-list')}
          </button>
        </>
      )}

      {confirmRemoveMember && (
        <ConfirmationDialog
          dialogName="StoriesSettings.confirmRemoveMember"
          actions={[
            {
              action: () =>
                onRemoveMembers(confirmRemoveMember.listId, [
                  confirmRemoveMember.uuid,
                ]),
              style: 'negative',
              text: i18n('StoriesSettings__remove--action'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveMember(undefined);
          }}
          theme={Theme.Dark}
          title={i18n('StoriesSettings__remove--title', [
            confirmRemoveMember.title,
          ])}
        >
          {i18n('StoriesSettings__remove--body')}
        </ConfirmationDialog>
      )}
    </ModalPage>
  );
}

type CheckboxRenderProps = {
  checkboxNode: ReactNode;
  labelNode: ReactNode;
  descriptionNode: ReactNode;
};

function CheckboxRender({
  checkboxNode,
  labelNode,
  descriptionNode,
}: CheckboxRenderProps) {
  return (
    <>
      {checkboxNode}
      <div className="StoriesSettingsModal__checkbox-container">
        <div className="StoriesSettingsModal__checkbox-label">{labelNode}</div>
        <div className="StoriesSettingsModal__checkbox-description">
          {descriptionNode}
        </div>
      </div>
    </>
  );
}

type EditMyStoryPrivacyPropsType = {
  hasDisclaimerAbove?: boolean;
  i18n: LocalizerType;
  learnMore: string;
  myStories: StoryDistributionListWithMembersDataType;
  onClickExclude: () => unknown;
  onClickOnlyShareWith: () => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  signalConnectionsCount: number;
} & Pick<
  PropsType,
  'setMyStoriesToAllSignalConnections' | 'toggleSignalConnectionsModal'
>;

export function EditMyStoryPrivacy({
  hasDisclaimerAbove,
  i18n,
  learnMore,
  myStories,
  onClickExclude,
  onClickOnlyShareWith,
  setSelectedContacts,
  setMyStoriesToAllSignalConnections,
  toggleSignalConnectionsModal,
  signalConnectionsCount,
}: EditMyStoryPrivacyPropsType): JSX.Element {
  const disclaimerElement = (
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
        id={learnMore}
      />
    </div>
  );

  return (
    <>
      {hasDisclaimerAbove && disclaimerElement}

      <Checkbox
        checked={!myStories.members.length}
        isRadio
        label={i18n('StoriesSettings__mine__all--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={() => {
          setMyStoriesToAllSignalConnections();
        }}
      >
        {({ checkboxNode, labelNode, checked }) => {
          return (
            <CheckboxRender
              checkboxNode={checkboxNode}
              labelNode={labelNode}
              descriptionNode={
                checked && (
                  <>
                    {i18n('icu:StoriesSettings__viewers', {
                      count: signalConnectionsCount,
                    })}
                  </>
                )
              }
            />
          );
        }}
      </Checkbox>

      <Checkbox
        checked={myStories.isBlockList && myStories.members.length > 0}
        isRadio
        label={i18n('StoriesSettings__mine__exclude--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={noop}
        onClick={() => {
          if (myStories.isBlockList) {
            setSelectedContacts(myStories.members);
          }
          onClickExclude();
        }}
      >
        {({ checkboxNode, labelNode, checked }) => {
          return (
            <CheckboxRender
              checkboxNode={checkboxNode}
              labelNode={labelNode}
              descriptionNode={
                checked && (
                  <>
                    {i18n('icu:StoriesSettings__viewers', {
                      count: myStories.members.length,
                    })}
                  </>
                )
              }
            />
          );
        }}
      </Checkbox>

      <Checkbox
        checked={!myStories.isBlockList && myStories.members.length > 0}
        isRadio
        label={i18n('StoriesSettings__mine__only--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={noop}
        onClick={() => {
          if (!myStories.isBlockList) {
            setSelectedContacts(myStories.members);
          }
          onClickOnlyShareWith();
        }}
      >
        {({ checkboxNode, labelNode, checked }) => {
          return (
            <CheckboxRender
              checkboxNode={checkboxNode}
              labelNode={labelNode}
              descriptionNode={
                checked && (
                  <>
                    {i18n('icu:StoriesSettings__viewers', {
                      count: myStories.members.length,
                    })}
                  </>
                )
              }
            />
          );
        }}
      </Checkbox>

      {!hasDisclaimerAbove && disclaimerElement}
    </>
  );
}

type EditDistributionListModalPropsType = {
  onCreateList: (name: string, viewerUuids: Array<UUIDStringType>) => unknown;
  onViewersUpdated: (viewerUuids: Array<UUIDStringType>) => unknown;
  page:
    | Page.AddViewer
    | Page.ChooseViewers
    | Page.HideStoryFrom
    | Page.NameStory;
  selectedContacts: Array<ConversationType>;
  onClose: () => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  onBackButtonClick: () => void;
} & Pick<PropsType, 'candidateConversations' | 'getPreferredBadge' | 'i18n'>;

export function EditDistributionListModal({
  candidateConversations,
  getPreferredBadge,
  i18n,
  onCreateList,
  onViewersUpdated,
  page,
  onClose,
  selectedContacts,
  setSelectedContacts,
  onBackButtonClick,
}: EditDistributionListModalPropsType): JSX.Element {
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
    const footer = (
      <Button
        disabled={!storyName}
        onClick={() => {
          onCreateList(storyName, Array.from(selectedConversationUuids));
          setStoryName('');
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('done')}
      </Button>
    );

    return (
      <ModalPage
        modalName="StoriesSettings__name-story"
        title={i18n('StoriesSettings__name-story')}
        modalFooter={footer}
        i18n={i18n}
        onBackButtonClick={onBackButtonClick}
        onClose={onClose}
        {...modalCommonProps}
      >
        <Input
          i18n={i18n}
          onChange={setStoryName}
          placeholder={i18n('StoriesSettings__name-placeholder')}
          moduleClassName="StoriesSettingsModal__input"
          value={storyName}
        />

        <div className="StoriesSettingsModal__visibility">
          {i18n('SendStoryModal__new-custom--name-visibility')}
        </div>

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
                size={AvatarSize.THIRTY_TWO}
                theme={ThemeType.dark}
                title={contact.title}
              />
              <span className="StoriesSettingsModal__list__title">
                {contact.title}
              </span>
            </span>
          </div>
        ))}
      </ModalPage>
    );
  }

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

  let footer: JSX.Element | undefined;
  if (isChoosingViewers) {
    footer = (
      <Button
        disabled={selectedContacts.length === 0}
        onClick={() => {
          onViewersUpdated(Array.from(selectedConversationUuids));
        }}
        variant={ButtonVariant.Primary}
      >
        {page === Page.AddViewer ? i18n('done') : i18n('next2')}
      </Button>
    );
  } else if (page === Page.HideStoryFrom) {
    footer = (
      <Button
        disabled={selectedContacts.length === 0}
        onClick={() => {
          onViewersUpdated(Array.from(selectedConversationUuids));
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('update')}
      </Button>
    );
  }

  return (
    <ModalPage
      modalName={`EditDistributionListModal__${page}`}
      i18n={i18n}
      modalFooter={footer}
      onBackButtonClick={onBackButtonClick}
      onClose={onClose}
      title={
        page === Page.HideStoryFrom
          ? i18n('StoriesSettings__hide-story')
          : i18n('StoriesSettings__choose-viewers')
      }
      padded={page !== Page.ChooseViewers && page !== Page.AddViewer}
      {...modalCommonProps}
    >
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
        <ContactPills moduleClassName="StoriesSettingsModal__tags">
          {selectedContacts.map(contact => (
            <ContactPill
              key={contact.id}
              acceptedMessageRequest={contact.acceptedMessageRequest}
              avatarPath={contact.avatarPath}
              color={contact.color}
              firstName={contact.firstName}
              i18n={i18n}
              id={contact.id}
              isMe={contact.isMe}
              phoneNumber={contact.phoneNumber}
              profileName={contact.profileName}
              sharedGroupNames={contact.sharedGroupNames}
              title={contact.title}
              onClickRemove={() => toggleSelectedConversation(contact.id)}
            />
          ))}
        </ContactPills>
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
                lookupConversationWithoutUuid={asyncShouldNeverBeCalled}
                onClickArchiveButton={shouldNeverBeCalled}
                onClickContactCheckbox={(conversationId: string) => {
                  toggleSelectedConversation(conversationId);
                }}
                onSelectConversation={shouldNeverBeCalled}
                renderMessageSearchResult={() => {
                  shouldNeverBeCalled();
                  return <div />;
                }}
                rowCount={rowCount}
                setIsFetchingUUID={shouldNeverBeCalled}
                shouldRecomputeRowHeights={false}
                showChooseGroupMembers={shouldNeverBeCalled}
                showConversation={shouldNeverBeCalled}
                showUserNotFoundModal={shouldNeverBeCalled}
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
    </ModalPage>
  );
}

type GroupStorySettingsModalProps = {
  i18n: LocalizerType;
  group: ConversationType;
  onClose(): void;
  onBackButtonClick(): void;
  getConversationByUuid(uuid: UUIDStringType): ConversationType | undefined;
  onRemoveGroup(group: ConversationType): void;
};

export function GroupStorySettingsModal({
  i18n,
  group,
  onClose,
  onBackButtonClick,
  getConversationByUuid,
  onRemoveGroup,
}: GroupStorySettingsModalProps): JSX.Element {
  const groupMemberships = getGroupMemberships(group, getConversationByUuid);
  return (
    <ModalPage
      modalName="GroupStorySettingsModal"
      i18n={i18n}
      onClose={onClose}
      onBackButtonClick={onBackButtonClick}
      title={group.title}
      {...modalCommonProps}
    >
      <div className="GroupStorySettingsModal__header">
        <Avatar
          acceptedMessageRequest={group.acceptedMessageRequest}
          avatarPath={group.avatarPath}
          badge={undefined}
          color={group.color}
          conversationType={group.type}
          i18n={i18n}
          isMe={false}
          sharedGroupNames={[]}
          size={AvatarSize.THIRTY_TWO}
          title={group.title}
        />
        <span className="GroupStorySettingsModal__title">{group.title}</span>
      </div>

      <hr className="StoriesSettingsModal__divider" />

      <p className="GroupStorySettingsModal__members_title">
        {i18n('icu:GroupStorySettingsModal__members_title')}
      </p>
      {groupMemberships.memberships.map(membership => {
        const { member } = membership;
        return (
          <div
            key={member.id}
            className="GroupStorySettingsModal__members_item"
          >
            <Avatar
              acceptedMessageRequest={member.acceptedMessageRequest}
              avatarPath={member.avatarPath}
              badge={undefined}
              color={member.color}
              conversationType={member.type}
              i18n={i18n}
              isMe={false}
              sharedGroupNames={[]}
              size={AvatarSize.THIRTY_TWO}
              title={member.title}
            />
            <p className="GroupStorySettingsModal__members_item__name">
              {member.title}
            </p>
          </div>
        );
      })}

      <p className="GroupStorySettingsModal__members_help">
        {i18n('icu:GroupStorySettingsModal__members_help', {
          groupTitle: group.title,
        })}
      </p>

      <hr className="StoriesSettingsModal__divider" />

      <button
        className="GroupStorySettingsModal__remove_group"
        onClick={() => onRemoveGroup(group)}
        type="button"
      >
        {i18n('icu:GroupStorySettingsModal__remove_group')}
      </button>
    </ModalPage>
  );
}
