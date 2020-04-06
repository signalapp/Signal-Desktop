module.exports = {
  // generics
  objWithClassAndText: (obj, classname, text) =>
    `//${obj}[contains(string(), "${text}")][contains(@class, "${classname}")]`,

  divRoleButtonWithText: text =>
    `//div[contains(string(), "${text}")][contains(@role, "button")]`,
  divRoleButtonWithTextDisabled: text =>
    `//div[contains(string(), "${text}")][contains(@role, "button")][contains(@class, "disabled")]`,
  divRoleButtonDangerWithText: text =>
    `${module.exports.divRoleButtonWithText(text)}[contains(@class, "danger")]`,
  inputWithPlaceholder: placeholder =>
    `//input[contains(@placeholder, "${placeholder}")]`,
  textAreaWithPlaceholder: placeholder =>
    `//textarea[contains(@placeholder, "${placeholder}")]`,
  byId: id => `//*[@id="${id}"]`,
  divWithClass: classname => `//div[contains(@class, "${classname}")]`,
  divWithClassAndText: (classname, text) =>
    module.exports.objWithClassAndText('div', classname, text),
  spanWithClassAndText: (classname, text) =>
    module.exports.objWithClassAndText('span', classname, text),
  toastWithText: text =>
    module.exports.divWithClassAndText('session-toast-wrapper', text),
};
