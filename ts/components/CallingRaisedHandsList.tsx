// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import type { ConversationsByDemuxIdType } from '../types/Calling';
import type { ServiceIdString } from '../types/ServiceId';
import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import { ModalHost } from './ModalHost';
import * as log from '../logging/log';

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly onClose: () => void;
  readonly onLowerMyHand: () => void;
  readonly localDemuxId: number | undefined;
  readonly conversationsByDemuxId: ConversationsByDemuxIdType;
  readonly raisedHands: Set<number>;
  readonly localHandRaised: boolean;
};

export function CallingRaisedHandsList({
  i18n,
  onClose,
  onLowerMyHand,
  localDemuxId,
  conversationsByDemuxId,
  raisedHands,
  localHandRaised,
}: PropsType): JSX.Element | null {
  const ourServiceId: ServiceIdString | undefined = localDemuxId
    ? conversationsByDemuxId.get(localDemuxId)?.serviceId
    : undefined;

  const participants = React.useMemo<Array<ConversationType>>(() => {
    const serviceIds: Set<ServiceIdString> = new Set();
    const conversations: Array<ConversationType> = [];
    raisedHands.forEach(demuxId => {
      const conversation = conversationsByDemuxId.get(demuxId);
      if (!conversation) {
        log.warn(
          'CallingRaisedHandsList: Failed to get conversationsByDemuxId for demuxId',
          { demuxId }
        );
        return;
      }

      const { serviceId } = conversation;
      if (serviceId) {
        if (serviceIds.has(serviceId)) {
          return;
        }

        serviceIds.add(serviceId);
      }

      conversations.push(conversation);
    });
    return conversations;
  }, [raisedHands, conversationsByDemuxId]);

  return (
    <ModalHost
      modalName="CallingRaisedHandsList"
      moduleClassName="CallingRaisedHandsList"
      onClose={onClose}
    >
      <div className="CallingRaisedHandsList module-calling-participants-list">
        <div className="module-calling-participants-list__header">
          <div className="module-calling-participants-list__title">
            {i18n('icu:CallingRaisedHandsList__Title', {
              count: participants.length,
            })}
          </div>
          <button
            type="button"
            className="module-calling-participants-list__close"
            onClick={onClose}
            tabIndex={0}
            aria-label={i18n('icu:close')}
          />
        </div>
        <ul className="module-calling-participants-list__list">
          {participants.map((participant: ConversationType, index: number) => (
            <li
              className="module-calling-participants-list__contact"
              key={participant.serviceId ?? index}
            >
              <div className="CallingRaisedHandsList__AvatarAndName module-calling-participants-list__avatar-and-name">
                <Avatar
                  acceptedMessageRequest={participant.acceptedMessageRequest}
                  avatarPath={participant.avatarPath}
                  badge={undefined}
                  color={participant.color}
                  conversationType="direct"
                  i18n={i18n}
                  isMe={participant.isMe}
                  profileName={participant.profileName}
                  title={participant.title}
                  sharedGroupNames={participant.sharedGroupNames}
                  size={AvatarSize.THIRTY_TWO}
                />
                {ourServiceId && participant.serviceId === ourServiceId ? (
                  <span className="module-calling-participants-list__name">
                    {i18n('icu:you')}
                  </span>
                ) : (
                  <ContactName
                    module="module-calling-participants-list__name"
                    title={participant.title}
                  />
                )}
              </div>
              <div className="module-calling-participants-list__status">
                {localHandRaised &&
                  ourServiceId &&
                  participant.serviceId === ourServiceId && (
                    <button
                      className="CallingRaisedHandsList__LowerMyHandLink"
                      type="button"
                      onClick={onLowerMyHand}
                    >
                      {i18n('icu:CallControls__RaiseHands--lower')}
                    </button>
                  )}
                <div className="CallingRaisedHandsList__NameHandIcon" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ModalHost>
  );
}
