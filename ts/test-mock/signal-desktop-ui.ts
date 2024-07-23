import { Locator } from 'playwright';
import type { App } from './playwright';

export class SignalDesktopUI {
  constructor(private app: App) {}

  public openFirstConversation = async (): Promise<void> => {
    const window = await this.app.getWindow();
    const leftPane = window.locator('#LeftPane');

    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();
  };

  public editMessage = async (
    timestamp: Long | null | undefined,
    text: string
  ): Promise<void> => {
    const editButton = await this.editMessageButton(timestamp);

    await editButton.click();

    await this.typeMessage(text);

    await this.sendMessage();
  };

  public isShowingEditMessageMenuItem = async (
    timestamp: Long | null | undefined
  ): Promise<boolean> => {
    const page = await this.app.getWindow();

    await page
      .getByTestId(`${timestamp}`)
      .locator('.module-message__buttons__menu')
      .click();

    const result = await page
      .getByRole('menuitem', { name: 'Edit' })
      .isVisible();

    await page.keyboard.press('Escape');

    return result;
  };

  public typeMessage = async (text: string): Promise<void> => {
    const messageTextInput = await this.getMessageTextInput();
    await messageTextInput.fill(text);
  };

  public clearMessage = async (): Promise<void> => {
    const messageTextInput = await this.getMessageTextInput();
    await messageTextInput.clear();
  };

  public sendMessage = async (): Promise<void> => {
    const messageTextInput = await this.getMessageTextInput();
    await messageTextInput.press('Enter');
  };

  public messageText = async (): Promise<string | null> => {
    const messageTextInput = await this.getMessageTextInput();
    return messageTextInput.textContent();
  };

  private getMessageTextInput = (): Promise<Locator> =>
    this.app.waitForEnabledComposer();
}
