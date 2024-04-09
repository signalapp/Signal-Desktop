import FocusTrap from 'focus-trap-react';
import React, { useState } from 'react';
import { useMount } from 'react-use';

/**
 * Focus trap which activates on mount.
 */
export function SessionFocusTrap(props: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);

  // Activate the trap on mount so we **should** have a button to tab through. focus-trap-react will throw if we don't have a button when the trap becomes active.
  // We might still have an issue for dialogs which have buttons added with a useEffect, or asynchronously but have no buttons on mount.
  // If that happens we will need to force those dialogs to have at least one button so focus-trap-react does not throw.
  useMount(() => setActive(true));

  return (
    <FocusTrap active={active} focusTrapOptions={{ initialFocus: false, allowOutsideClick: true }}>
      {props.children}
    </FocusTrap>
  );
}
