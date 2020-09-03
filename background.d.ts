export interface ConfirmationDialogParams {
  title?: string;
  message: string;
  messageSub?: string;
  resolve?: any;
  reject?: any;
  okText?: string;
  okTheme?: string;
  closeTheme?: string;
  cancelText?: string;
  hideCancel?: boolean;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
}
