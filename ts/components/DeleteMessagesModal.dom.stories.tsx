// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import DeleteMessagesModal from './DeleteMessagesModal.dom.tsx';
import type { DeleteMessagesModalProps } from './DeleteMessagesModal.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DeleteMessagesModal',
} satisfies Meta;

function Template(props: Partial<DeleteMessagesModalProps>): React.JSX.Element {
  const [open, setOpen] = useState(true);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <AxoButton.Root size="md" variant="secondary" onClick={handleOpen}>
        Open Dialog
      </AxoButton.Root>
      {open && (
        <DeleteMessagesModal
          isMe={false}
          canDeleteForEveryone={false}
          needsAdminDelete={false}
          isDeletingOwnMessages={false}
          hasSeenAdminDeleteEducationDialog={false}
          i18n={i18n}
          messageCount={1}
          onClose={handleClose}
          onDeleteForMe={action('onDeleteForMe')}
          onDeleteForEveryone={action('onDeleteForEveryone')}
          onSeenAdminDeleteEducationDialog={action(
            'onSeenAdminDeleteEducationDialog'
          )}
          showToast={action('showToast')}
          {...props}
        />
      )}
    </>
  );
}

export function DeleteForMeOnly(): React.JSX.Element {
  return <Template />;
}

export function DeleteForEveryone(): React.JSX.Element {
  return <Template canDeleteForEveryone />;
}

export function DeleteForEveryoneMultiple(): React.JSX.Element {
  return <Template canDeleteForEveryone messageCount={3} />;
}

export function AdminDelete(): React.JSX.Element {
  return <Template canDeleteForEveryone needsAdminDelete />;
}

export function AdminDeleteMultiple(): React.JSX.Element {
  return <Template canDeleteForEveryone needsAdminDelete messageCount={3} />;
}

export function AdminDeleteAfterOnboarding(): React.JSX.Element {
  return (
    <Template
      canDeleteForEveryone
      needsAdminDelete
      hasSeenAdminDeleteEducationDialog
    />
  );
}

export function NoteToSelf(): React.JSX.Element {
  return <Template isMe />;
}

export function NoteToSelfMultiple(): React.JSX.Element {
  return <Template isMe messageCount={3} />;
}

export function TooManyMessagesForDeleteForEveryone(): React.JSX.Element {
  return <Template canDeleteForEveryone messageCount={31} />;
}
