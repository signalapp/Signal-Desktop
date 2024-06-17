import { Slide, ToastContainer, ToastContainerProps } from 'react-toastify';
import styled from 'styled-components';

// NOTE: https://styled-components.com/docs/faqs#how-can-i-override-styles-with-higher-specificity
const StyledToastContainer = styled(ToastContainer)`
  &&&.Toastify__toast-container {
  }
  .Toastify__toast {
    background: var(--toast-background-color);
    color: var(--toast-text-color);
    border-left: 4px solid var(--toast-color-strip-color);
  }
  .Toastify__toast--error {
  }
  .Toastify__toast--warning {
  }
  .Toastify__toast--success {
  }
  .Toastify__toast-body {
    line-height: 1.4;
  }
  .Toastify__progress-bar {
    background-color: var(--toast-progress-color);
  }
  .Toastify__close-button {
    color: var(--toast-text-color);
  }
`;

const WrappedToastContainer = ({
  className,
  ...rest
}: ToastContainerProps & { className?: string }) => (
  <div className={className}>
    <StyledToastContainer {...rest} />
  </div>
);

export const SessionToastContainer = () => {
  return (
    <WrappedToastContainer
      position="bottom-right"
      autoClose={5000}
      hideProgressBar={true}
      newestOnTop={true}
      closeOnClick={true}
      rtl={false}
      pauseOnFocusLoss={false}
      draggable={false}
      pauseOnHover={true}
      transition={Slide}
      limit={5}
    />
  );
};
