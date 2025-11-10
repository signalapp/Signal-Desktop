// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { tw } from '../../../axo/tw.dom.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';
import { Modal } from '../../Modal.dom.js';
import { Avatar, AvatarSize } from '../../Avatar.dom.js';
import { ContactName } from '../ContactName.dom.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import type {
  PollVoteWithUserType,
  PollWithResolvedVotersType,
} from '../../../state/selectors/message.preload.js';

type PollVotesModalProps = {
  i18n: LocalizerType;
  poll: PollWithResolvedVotersType;
  onClose: () => void;
  endPoll: (messageId: string) => void;
  canEndPoll?: boolean;
  messageId: string;
};

export function PollVotesModal({
  i18n,
  poll,
  onClose,
  endPoll,
  canEndPoll,
  messageId,
}: PollVotesModalProps): JSX.Element {
  return (
    <Modal
      modalName="PollVotesModal"
      i18n={i18n}
      title={i18n('icu:PollVotesModal__title')}
      onClose={onClose}
      hasXButton
      padded={false}
    >
      <div className={tw('flex flex-col gap-5 px-6 pb-4')}>
        <div className={tw('mt-4 text-label-primary')}>
          <div className={tw('mb-3 type-title-small')}>
            {i18n('icu:PollVotesModal__questionLabel')}
          </div>

          <div className={tw('type-body-large')}>{poll.question}</div>
        </div>

        {poll.options.map((option, index, array) => {
          const voters = poll.votesByOption.get(index) || [];
          const optionKey = `option-${index}`;
          const isLastOption = index === array.length - 1;

          return (
            <React.Fragment key={optionKey}>
              <div className={tw('flex flex-col')}>
                {/* Option Header */}
                <div
                  className={tw(
                    'mb-3 flex items-start gap-3 text-label-primary'
                  )}
                >
                  <div className={tw('type-title-small')}>{option}</div>
                  <div
                    className={tw('ms-auto mt-[2px] shrink-0 type-body-medium')}
                  >
                    {i18n('icu:PollVotesModal__voteCount', {
                      count: voters.length,
                    })}
                  </div>
                </div>

                {/* Voters List */}
                <div className={tw('flex flex-col gap-4')}>
                  {voters.map((vote: PollVoteWithUserType) => (
                    <div
                      key={vote.from.id}
                      className={tw('flex items-center gap-3')}
                    >
                      <Avatar
                        avatarUrl={vote.from.avatarUrl}
                        badge={undefined}
                        color={vote.from.color}
                        conversationType="direct"
                        i18n={i18n}
                        noteToSelf={false}
                        phoneNumber={vote.from.phoneNumber}
                        profileName={vote.from.profileName}
                        sharedGroupNames={vote.from.sharedGroupNames}
                        size={AvatarSize.THIRTY_SIX}
                        title={vote.from.title}
                      />
                      <div className={tw('min-w-0 flex-1')}>
                        <ContactName
                          title={vote.from.title}
                          module={tw('type-body-large text-label-primary')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {!isLastOption && (
                <hr className={tw('border-t-[0.5px] border-label-secondary')} />
              )}
            </React.Fragment>
          );
        })}

        {poll.totalNumVotes === 0 && (
          <div
            className={tw(
              'flex items-center justify-center',
              'type-body-large text-label-secondary'
            )}
          >
            {i18n('icu:PollVotesModal__noVotes')}
          </div>
        )}

        {!poll.terminatedAt && canEndPoll && (
          <>
            <hr className={tw('border-t-[0.5px] border-label-secondary')} />
            <div className={tw('flex justify-center')}>
              <AxoButton.Root
                size="lg"
                variant="secondary"
                onClick={() => {
                  endPoll(messageId);
                  onClose();
                }}
              >
                {i18n('icu:Poll__end-poll')}
              </AxoButton.Root>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
