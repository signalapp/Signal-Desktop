// Fork of https://github.com/uiureo/link-text with HTML escaping disabled as we leverage
// jQuery’s escaping mechanism:

var linkify = require('linkify-it')()
var escape = require('escape-html')

function createLink (url, text, attrs) {
  attrs = attrs || {}

  var html = []
  html.push('<a ')
  html.push('href="' + url + '"')
  Object.keys(attrs).forEach(function (key) {
    html.push(' ' + key + '="' + attrs[key] + '"')
  })
  html.push('>')
  html.push(decodeURIComponent(text))
  html.push('</a>')

  return html.join('')
}

module.exports = function (text, attrs) {
  attrs = attrs || {}
  text = escape(text)

  var matchData = linkify.match(text) || []

  var result = []
  var last = 0

  matchData.forEach(function (match) {
    if (last < match.index) {
      result.push(text.slice(last, match.index))
    }

    result.push(
      createLink(match.url, match.text, attrs)
    )

    last = match.lastIndex
  })

  result.push(text.slice(last))

  return result.join('')
}
