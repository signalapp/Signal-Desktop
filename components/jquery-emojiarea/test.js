var util = {};

util.restoreSelection = (function() {
  if (window.getSelection) {
    return function(savedSelection) {
      var sel = window.getSelection();
      sel.removeAllRanges();
      for (var i = 0, len = savedSelection.length; i < len; ++i) {
        sel.addRange(savedSelection[i]);
      }
    };
  } else if (document.selection && document.selection.createRange) {
    return function(savedSelection) {
      if (savedSelection) {
        savedSelection.select();
      }
    };
  }
})();

util.saveSelection = (function() {
  if (window.getSelection) {
    return function() {
      var sel = window.getSelection(), ranges = [];
      if (sel.rangeCount) {
        for (var i = 0, len = sel.rangeCount; i < len; ++i) {
          ranges.push(sel.getRangeAt(i));
        }
      }
      return ranges;
    };
  } else if (document.selection && document.selection.createRange) {
    return function() {
      var sel = document.selection;
      return (sel.type.toLowerCase() !== 'none') ? sel.createRange() : null;
    };
  }
})();

util.replaceSelection = (function() {
  if (window.getSelection) {
    return function(content) {
      var range, sel = window.getSelection();
      var node = typeof content === 'string' ? document.createTextNode(content) : content;
      if (sel.getRangeAt && sel.rangeCount) {
        range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(' '));
        range.insertNode(node);
        range.setStart(node, 0);

        window.setTimeout(function() {
          range = document.createRange();
          range.setStartAfter(node);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }, 0);
      }
    }
  } else if (document.selection && document.selection.createRange) {
    return function(content) {
      var range = document.selection.createRange();
      if (typeof content === 'string') {
        range.text = content;
      } else {
        range.pasteHTML(content.outerHTML);
      }
    }
  }
})();

util.insertAtCursor = function(text, el) {
  text = ' ' + text;
  var val = el.value, endIndex, startIndex, range;
  if (typeof el.selectionStart != 'undefined' && typeof el.selectionEnd != 'undefined') {
    startIndex = el.selectionStart;
    endIndex = el.selectionEnd;
    el.value = val.substring(0, startIndex) + text + val.substring(el.selectionEnd);
    el.selectionStart = el.selectionEnd = startIndex + text.length;
  } else if (typeof document.selection != 'undefined' && typeof document.selection.createRange != 'undefined') {
    el.focus();
    range = document.selection.createRange();
    range.text = text;
    range.select();
  }
};

util.extend = function(a, b) {
  if (typeof a === 'undefined' || !a) { a = {}; }
  if (typeof b === 'object') {
    for (var key in b) {
      if (b.hasOwnProperty(key)) {
        a[key] = b[key];
      }
    }
  }
  return a;
};

util.escapeRegex = function(str) {
  return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
};

util.htmlEntities = function(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};



function EmojiMenu($button, $container, $textarea) {
  this.icons = emojimenu_icons;
  this.path = emojimenu_path;
  this.$button = $button;
  this.$textarea = $textarea;
  var self = this;
  var $body = $container;
  var $window = $(window);

  this.visible = false;
  this.emojiarea = null;
  this.$menu = $('<div>');
  this.$menu.addClass('emoji-menu');
  this.$menu.hide();
  this.$items = $('<div>').appendTo(this.$menu);

  $body.append(this.$menu);

  // $body.on('keydown', function(e) {
  //   if (e.keyCode === KEY_ESC || e.keyCode === KEY_TAB) {
  //     self.hide();
  //   }
  // });

  $body.on('mouseup', function() {
    self.hide();
  });

  // $window.on('resize', function() {
  //   if (self.visible) self.reposition();
  // });

  this.$menu.on('mouseup', 'a', function(e) {
    e.stopPropagation();
    return false;
  });

  this.$menu.on('click', 'a', function(e) {
    var emoji = $('.label', $(this)).text();
    var group = $('.label', $(this)).parent().parent().attr('group');
    if(group && emoji !== ''){
      window.setTimeout(function() {
        self.onItemSelected.apply(self, [group, emoji]);
      }, 0);
      e.stopPropagation();
      return false;
    }
  });
  this.load();
};

EmojiMenu.prototype.onItemSelected = function(group, emoji) {
  if (!this.icons[group]['icons'].hasOwnProperty(emoji)) return;
  util.insertAtCursor(emoji, this.$textarea[0]);
  this.$textarea.trigger('change');
  this.$textarea.focus();
  this.hide();
};

EmojiMenu.prototype.createIcon = function(group, emoji) {
  var filename = this.icons[group]['icons'][emoji];
  var path = this.path || '';
  if (path.length && path.charAt(path.length - 1) !== '/') {
    path += '/';
  }
  return '<img src="' + path + filename + '" alt="' + util.htmlEntities(emoji) + '">';
};

EmojiMenu.prototype.load = function() {
  var html = [];
  var groups = [];
  var options = this.icons;
  var path = this.path;
  if (path.length && path.charAt(path.length - 1) !== '/') {
    path += '/';
  }

  var group_emoji = [':smile:', ':sunny:', ':squirrel:', ':corn:', ':one:'];
  var k = 0;

  groups.push('<ul class="group-selector">');
  for (var group in options) {
    groups.push('<a href="#group_' + group + '" class="tab_switch"><li>' + '<img src="' + path + options[group]['icons'][group_emoji[k]] + '"></img>' + '</li></a>'); //options[group]['name']
    html.push('<div class="select_group" group="' + group + '" id="group_' + group + '">');
    for (var key in options[group]['icons']) {
      if (options[group]['icons'].hasOwnProperty(key)) {
        var filename = options[key];
        html.push('<a href="javascript:void(0)" title="' + util.htmlEntities(key) + '">' + this.createIcon(group, key) + '<span class="label">' + util.htmlEntities(key) + '</span></a>');
      }
    }
    html.push('</div>');
    k += 1;
  }
  groups.push('</ul>');
  this.$items.html(html.join(''));
  this.$menu.prepend(groups.join(''));
  this.$menu.find('.tab_switch').each(function(i) {
    if (i != 0) {
      var select = $(this).attr('href');
      $(select).hide();
    } else {
      $(this).addClass('active');
    }
    $(this).click(function() {
      $(this).addClass('active');
      $(this).siblings().removeClass('active');
      $('.select_group').hide();
      var select = $(this).attr('href');
      $(select).show();
    });
  });
};

EmojiMenu.prototype.reposition = function() {
  // var $button = $button; //this.emojiarea.$button;
  var offset = this.$button.offset();
  offset.top -= 205;
  offset.left -= 308;

  this.$menu.css({
    top: offset.top,
    left: offset.left
  });
};

EmojiMenu.prototype.hide = function(callback) {
  // if (this.emojiarea) {
  //   this.menu = null;
  //   this.$button.removeClass('on');
  // }
  this.visible = false;
  this.$menu.hide();
};

EmojiMenu.prototype.show = function(emojiarea) {
  // if (this.emojiarea && this.emojiarea === emojiarea) return;
  // this.emojiarea = emojiarea;
  // this.emojiarea.menu = this;

  this.reposition();
  this.$menu.show();
  this.visible = true;
};

EmojiMenu.show = (function() {
  var menu = null;
  return function(emojiarea) {
    menu = menu || new EmojiMenu();
    menu.show(emojiarea);
  };
})();
