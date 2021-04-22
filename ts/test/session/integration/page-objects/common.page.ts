export = {
  // generics
  objWithClassAndText: (obj: string, classname: string, text: string) =>
    `//${obj}[contains(string(), "${text}")][contains(@class, "${classname}")]`,

  divRoleButtonWithText: (text: string) =>
    `//div[contains(string(), "${text}")][contains(@role, "button")]`,
  divRoleButtonWithTextDisabled: (text: string) =>
    `//div[contains(string(), "${text}")][contains(@role, "button")][contains(@class, "disabled")]`,
  divRoleButtonDangerWithText: (text: string) =>
    `${module.exports.divRoleButtonWithText(text)}[contains(@class, "danger")]`,
  inputWithPlaceholder: (placeholder: string) =>
    `//input[contains(@placeholder, "${placeholder}")]`,
  inputWithId: (id: string) => `//input[contains(@id, '${id}')]`,
  textAreaWithPlaceholder: (placeholder: string) =>
    `//textarea[contains(@placeholder, "${placeholder}")]`,
  textAreaWithClass: (classname: string) => `//textarea[contains(@class, "${classname}")]`,
  byId: (id: string) => `//*[@id="${id}"]`,
  divWithClass: (classname: string) => `//div[contains(@class, "${classname}")]`,
  divWithClassAndText: (classname: string, text: string) =>
    module.exports.objWithClassAndText('div', classname, text),
  spanWithClassAndText: (classname: string, text: string) =>
    module.exports.objWithClassAndText('span', classname, text),
  toastWithText: (text: string) =>
    module.exports.divWithClassAndText('session-toast-wrapper', text),
  toastCloseButton:
    '//div[contains(@class, "session-toast-wrapper")]//div[contains(@class, "toast-close")]/div',
};
