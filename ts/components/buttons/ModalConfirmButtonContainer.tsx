import styled from 'styled-components';
import { Flex } from '../basic/Flex';

/** We use this in the modals only to bypass the padding on the body so the buttons take up the full space width of the modal window
 * See .session-modal__body for padding values
 */
export const ModalConfirmButtonContainer = styled(Flex)`
  margin-top: 0px;
  margin-right: calc(var(--margins-lg) * -1);
  margin-bottom: calc(var(--margins-lg) * -1);
  margin-left: calc(var(--margins-lg) * -1);
`;
