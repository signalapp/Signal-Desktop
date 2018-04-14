// Fork of https://github.com/uiureo/link-text with HTML escaping disabled as we leverage
// jQuery’s escaping mechanism:

const linkify = require('linkify-it')();

function createLink(url, text, attrs = {}) {
  const html = [];
  html.push('<a ');
  html.push(`href="${url}"`);
  Object.keys(attrs).forEach((key) => {
    html.push(` ${key}="${attrs[key]}"`);
  });
  html.push('>');
  html.push(decodeURIComponent(text));
  html.push('</a>');

  return html.join('');
}

module.exports = (text, attrs = {}) => {
  const matchData = linkify.match(text) || [];

  const result = [];
  let last = 0;

  matchData.forEach((match) => {
    if (last < match.index) {
      result.push(text.slice(last, match.index));
    }

    result.push(createLink(match.url, match.text, attrs));

    last = match.lastIndex;
  });

  result.push(text.slice(last));

  return result.join('');
};
