/**
 * emojiarea - A rich textarea control that supports emojis, WYSIWYG-style.
 * Copyright (c) 2012 DIY Co
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * @author Brian Reavis <brian@diy.org>
 */

(function($, window, document) {

	var EmojiMenu = EmojiMenu || {};

	var ELEMENT_NODE = 1;
	var TEXT_NODE = 3;
	var TAGS_BLOCK = ['p', 'div', 'pre', 'form'];
	var KEY_ESC = 27;
	var KEY_TAB = 9;

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	$.emojiarea = {
		path: '',
		icons: {},
		defaults: {
			button: null,
			buttonLabel: 'Emojis',
			buttonPosition: 'before'
		}
	};

	$.fn.emojiarea = function(options) {
		options = $.extend({}, $.emojiarea.defaults, options);
		return this.each(function() {
			var $textarea = $(this);
			if ('contentEditable' in document.body && options.wysiwyg !== false) {
				new EmojiArea_WYSIWYG($textarea, options);
			} else {
				new EmojiArea_Plain($textarea, options);
			}
		});
	};

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	var EmojiArea = function() {};

	EmojiArea.prototype.setup = function() {
		var self = this;

		this.$editor.on('focus', function() { self.hasFocus = true; });
		this.$editor.on('blur', function() { self.hasFocus = false; });

		this.setupButton();
	};

	EmojiArea.prototype.setupButton = function() {
		var self = this;
		var $button;

		if (this.options.button) {
			$button = $(this.options.button);
		} else if (this.options.button !== false) {
			$button = $('<a href="javascript:void(0)">');
			$button.html(this.options.buttonLabel);
			$button.addClass('emoji-button');
			$button.attr({title: this.options.buttonLabel});
			this.$editor[this.options.buttonPosition]($button);
		} else {
			$button = $('');
		}

		$button.on('click', function(e) {
			EmojiMenu.show(self);
			e.stopPropagation();
		});

		this.$button = $button;
	};

	EmojiArea.createIcon = function(group, emoji) {
		var filename = $.emojiarea.icons[group]['icons'][emoji];
		var path = $.emojiarea.path || '';
		if (path.length && path.charAt(path.length - 1) !== '/') {
			path += '/';
		}
		return '<img src="' + path + filename + '" alt="' + util.htmlEntities(emoji) + '">';
	};

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	/**
	 * Editor (plain-text)
	 *
	 * @constructor
	 * @param {object} $textarea
	 * @param {object} options
	 */

	var EmojiArea_Plain = function($textarea, options) {
		this.options = options;
		this.$textarea = $textarea;
		this.$editor = $textarea;
		this.setup();
	};

	EmojiArea_Plain.prototype.insert = function(group, emoji) {
		if (!$.emojiarea.icons[group]['icons'].hasOwnProperty(emoji)) return;
		util.insertAtCursor(emoji, this.$textarea[0]);
		this.$textarea.trigger('change');
	};

	EmojiArea_Plain.prototype.val = function() {
		return this.$textarea.val();
	};

	util.extend(EmojiArea_Plain.prototype, EmojiArea.prototype);

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	/**
	 * Editor (rich)
	 *
	 * @constructor
	 * @param {object} $textarea
	 * @param {object} options
	 */

	var EmojiArea_WYSIWYG = function($textarea, options) {
		var self = this;

		this.options = options;
		this.$textarea = $textarea;
		this.$editor = $('<div>').addClass('emoji-wysiwyg-editor');
		this.$editor.text($textarea.val());
		this.$editor.attr({contenteditable: 'true'});
		this.$editor.on('blur keyup paste', function() { return self.onChange.apply(self, arguments); });
		this.$editor.on('mousedown focus', function() { document.execCommand('enableObjectResizing', false, false); });
		this.$editor.on('blur', function() { document.execCommand('enableObjectResizing', true, true); });

		var html = this.$editor.text();
		var emojis = $.emojiarea.icons;
		for (var group in emojis) {
			for (var key in emojis[group]['icons']) {
				if (emojis[group]['icons'].hasOwnProperty(key)) {
					html = html.replace(new RegExp(util.escapeRegex(key), 'g'), EmojiArea.createIcon(group, key));
				}
			}
		}
		this.$editor.html(html);

		$textarea.hide().after(this.$editor);

		this.setup();

		this.$button.on('mousedown', function() {
			if (self.hasFocus) {
				self.selection = util.saveSelection();
			}
		});
	};

	EmojiArea_WYSIWYG.prototype.onChange = function() {
		this.$textarea.val(this.val()).trigger('change');
	};

	EmojiArea_WYSIWYG.prototype.insert = function(group, emoji) {
		var content;
		var $img = $(EmojiArea.createIcon(group, emoji));
		if ($img[0].attachEvent) {
			$img[0].attachEvent('onresizestart', function(e) { e.returnValue = false; }, false);
		}

		this.$editor.trigger('focus');
		if (this.selection) {
			util.restoreSelection(this.selection);
		}
		try { util.replaceSelection($img[0]); } catch (e) {}
		this.onChange();
	};

	EmojiArea_WYSIWYG.prototype.val = function() {
		var lines = [];
		var line  = [];

		var flush = function() {
			lines.push(line.join(''));
			line = [];
		};

		var sanitizeNode = function(node) {
			if (node.nodeType === TEXT_NODE) {
				line.push(node.nodeValue);
			} else if (node.nodeType === ELEMENT_NODE) {
				var tagName = node.tagName.toLowerCase();
				var isBlock = TAGS_BLOCK.indexOf(tagName) !== -1;

				if (isBlock && line.length) flush();

				if (tagName === 'img') {
					var alt = node.getAttribute('alt') || '';
					if (alt) line.push(alt);
					return;
				} else if (tagName === 'br') {
					flush();
				}

				var children = node.childNodes;
				for (var i = 0; i < children.length; i++) {
					sanitizeNode(children[i]);
				}

				if (isBlock && line.length) flush();
			}
		};

		var children = this.$editor[0].childNodes;
		for (var i = 0; i < children.length; i++) {
			sanitizeNode(children[i]);
		}

		if (line.length) flush();

		return lines.join('\n');
	};

	util.extend(EmojiArea_WYSIWYG.prototype, EmojiArea.prototype);

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

	/**
	 * Emoji Dropdown Menu
	 *
	 * @constructor
	 * @param {object} emojiarea
	 */
	function EmojiMenu() {
		var self = this;
		var $body = $(document.body);
		var $window = $(window);

		this.visible = false;
		this.emojiarea = null;
		this.$menu = $('<div>');
		this.$menu.addClass('emoji-menu');
		this.$menu.hide();
		this.$items = $('<div>').appendTo(this.$menu);

		$body.append(this.$menu);

		$body.on('keydown', function(e) {
			if (e.keyCode === KEY_ESC || e.keyCode === KEY_TAB) {
				self.hide();
			}
		});

		$body.on('mouseup', function() {
			self.hide();
		});

		$window.on('resize', function() {
			if (self.visible) self.reposition();
		});

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
		this.emojiarea.insert(group, emoji);
		this.hide();
	};

	EmojiMenu.prototype.load = function() {
		var html = [];
		var groups = [];
		var options = $.emojiarea.icons;
		var path = $.emojiarea.path;
		if (path.length && path.charAt(path.length - 1) !== '/') {
			path += '/';
		}
		groups.push('<ul class="group-selector">');
		for (var group in options) {
		groups.push('<a href="#group_' + group + '" class="tab_switch"><li>' + options[group]['name'] + '</li></a>');
		html.push('<div class="select_group" group="' + group + '" id="group_' + group + '">');
			for (var key in options[group]['icons']) {
				if (options[group]['icons'].hasOwnProperty(key)) {
					var filename = options[key];
					html.push('<a href="javascript:void(0)" title="' + util.htmlEntities(key) + '">' + EmojiArea.createIcon(group, key) + '<span class="label">' + util.htmlEntities(key) + '</span></a>');
				}
			}
		html.push('</div>');
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
		var $button = this.emojiarea.$button;
		var offset = $button.offset();
		offset.top += $button.outerHeight();
		offset.left += Math.round($button.outerWidth() / 2);

		this.$menu.css({
			top: offset.top,
			left: offset.left
		});
	};

	EmojiMenu.prototype.hide = function(callback) {
		if (this.emojiarea) {
			this.emojiarea.menu = null;
			this.emojiarea.$button.removeClass('on');
			this.emojiarea = null;
		}
		this.visible = false;
		this.$menu.hide();
	};

	EmojiMenu.prototype.show = function(emojiarea) {
		if (this.emojiarea && this.emojiarea === emojiarea) return;
		this.emojiarea = emojiarea;
		this.emojiarea.menu = this;

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

})(jQuery, window, document);
