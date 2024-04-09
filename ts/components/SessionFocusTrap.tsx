import FocusTrap from 'focus-trap-react';
import React from 'react';
import styled from 'styled-components';

const DefaultFocusButton = styled.button`
  opacity: 0;
  width: 0;
  height: 0;
`;

/**
 * The FocusTrap always require at least one element to be tabbable.
 * On some dialogs, we don't have any until the content is loaded, and depending on what is loaded, we might not have any tabbable elements in it.
 * This component renders the children inside a FocusTrap and always adds an invisible button to make FocusTrap happy.
 */
export function SessionDialogFocusTrap(props: { children: React.ReactNode }) {
  // FocusTrap needs a single child so props.children and the default button needs to be wrapped in a container.
  // This might cause some styling issues, but I didn't find any with our current dialogs
  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, allowOutsideClick: true }}>
      <div style={{ position: 'absolute' }}>
        <DefaultFocusButton />
        {props.children}
      </div>
    </FocusTrap>
  );
}
