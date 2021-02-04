// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { Avatar } from './Avatar';
import { Spinner } from './Spinner';

import { PreJoinConversationType } from '../state/ducks/conversations';

type CallbackType = () => unknown;

export type DataPropsType = PreJoinConversationType & {
  readonly join: CallbackType;
  readonly onClose: CallbackType;
};

export type HousekeepingPropsType = {
  readonly i18n: LocalizerType;
};

export type PropsType = DataPropsType & HousekeepingPropsType;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const GroupV2JoinDialog = React.memo((props: PropsType) => {
  const [isWorking, setIsWorking] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const {
    approvalRequired,
    avatar,
    i18n,
    join,
    memberCount,
    onClose,
    title,
  } = props;

  const joinString = approvalRequired
    ? i18n('GroupV2--join--request-to-join-button')
    : i18n('GroupV2--join--join-button');
  const promptString = approvalRequired
    ? i18n('GroupV2--join--prompt-with-approval')
    : i18n('GroupV2--join--prompt');
  const memberString =
    memberCount === 1
      ? i18n('GroupV2--join--member-count--single')
      : i18n('GroupV2--join--member-count--multiple', {
          count: memberCount.toString(),
        });

  const wrappedJoin = React.useCallback(() => {
    setIsWorking(true);
    setIsJoining(true);
    join();
  }, [join, setIsJoining, setIsWorking]);

  const wrappedClose = React.useCallback(() => {
    setIsWorking(true);
    onClose();
  }, [onClose, setIsWorking]);

  return (
    <div className="module-group-v2-join-dialog">
      <button
        aria-label={i18n('close')}
        type="button"
        disabled={isWorking}
        className="module-group-v2-join-dialog__close-button"
        onClick={wrappedClose}
      />
      <div className="module-group-v2-join-dialog__avatar">
        <Avatar
          avatarPath={avatar ? avatar.url : undefined}
          loading={avatar && !avatar.url}
          conversationType="group"
          title={title}
          size={80}
          i18n={i18n}
        />
      </div>
      <div className="module-group-v2-join-dialog__title">{title}</div>
      <div className="module-group-v2-join-dialog__metadata">
        {i18n('GroupV2--join--group-metadata', [memberString])}
      </div>
      <div className="module-group-v2-join-dialog__prompt">{promptString}</div>
      <div className="module-group-v2-join-dialog__buttons">
        <button
          className={classNames(
            'module-group-v2-join-dialog__button',
            'module-group-v2-join-dialog__button--secondary'
          )}
          disabled={isWorking}
          type="button"
          onClick={wrappedClose}
        >
          {i18n('cancel')}
        </button>
        <button
          className="module-group-v2-join-dialog__button"
          disabled={isWorking}
          ref={focusRef}
          type="button"
          onClick={wrappedJoin}
        >
          {isJoining ? (
            <Spinner size="20px" svgSize="small" direction="on-avatar" />
          ) : (
            joinString
          )}
        </button>
      </div>
    </div>
  );
});
