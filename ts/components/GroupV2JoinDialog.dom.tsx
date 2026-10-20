// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, type ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { Avatar, AvatarBlur } from './Avatar.dom.tsx';
import { GroupDescription } from './conversation/GroupDescription.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type GroupV2JoinDialogProps = Readonly<{
  i18n: LocalizerType;
  title: string;
  avatarUrl: string | null;
  avatarLoading: boolean;
  memberCount: number;
  groupDescription: string | null;
  approvalRequired: boolean;
  onJoin: () => void;
  onClose: () => void;
}>;

export function GroupV2JoinDialog(props: GroupV2JoinDialogProps): ReactNode {
  const { i18n, onClose } = props;

  const handleOpenChange = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-3 flex justify-center')}>
            <Avatar
              avatarUrl={props.avatarUrl ?? undefined}
              badge={undefined}
              blur={AvatarBlur.NoBlur}
              loading={props.avatarLoading}
              conversationType="group"
              title={props.title}
              size={80}
              i18n={i18n}
            />
          </div>
          <div className={tw('text-center')}>
            <AxoDialog.Title>
              <span className={tw('type-title-medium')}>{props.title}</span>
            </AxoDialog.Title>
            <p className={tw('text-secondary')}>
              {i18n('icu:GroupV2--join--group-metadata--full', {
                memberCount: props.memberCount,
              })}
            </p>

            {props.groupDescription != null &&
              props.groupDescription !== '' && (
                <div className={tw('mt-3 text-secondary')}>
                  <GroupDescription
                    i18n={i18n}
                    title={props.title}
                    text={props.groupDescription}
                  />
                </div>
              )}
            <AxoDialog.Description>
              {props.approvalRequired ? (
                <p className={tw('mt-6 type-body-small text-secondary')}>
                  {i18n('icu:GroupV2--join--prompt-with-approval')}
                </p>
              ) : (
                <p className={tw('mt-6 text-primary')}>
                  {i18n('icu:GroupV2--join--prompt')}
                </p>
              )}
            </AxoDialog.Description>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions width="fill">
            <AxoDialog.Action variant="subtle-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={props.onJoin}
              autoFocus
            >
              {props.approvalRequired
                ? i18n('icu:GroupV2--join--request-to-join-button')
                : i18n('icu:GroupV2--join--join-button')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
