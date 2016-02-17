/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ContextMenuView = Whisper.View.extend({
        templateName: 'context-menu',
        initialize: function (e, parent_view, items){
            this.render();

            // Attach to DOM
            console.log(parent_view.$el);
            console.log(this.$el);
            parent_view.$el.closest('body').append(this.$el);

            var context_menu = this;
            var $menu_list = this.$('.menu-list');

            items.forEach(function (item){
                var $a = $('<a/>').text(item.label);
                $a.click(function (){
                    context_menu.close();
                    item.action();
                });
                $menu_list.append($('<li/>').append($a));
            });

            // Position
            var w_height = this.$el.parent().height(),
                w_width = this.$el.parent().width(),
                menu_height = $menu_list.outerHeight(),
                menu_width = $menu_list.outerWidth(),
                min_padding = 10;

            if (e.pageY + menu_height + min_padding > w_height){
                $menu_list.css('bottom', w_height - e.pageY);
            } else {
                $menu_list.css('top', e.pageY);
            }
            if (e.pageX + menu_width + min_padding > w_width){
                $menu_list.css('right', w_width - e.pageX);
            } else {
                $menu_list.css('left', e.pageX);
            }

            $menu_list.blur(function (){
                context_menu.close();
            }).bind('contextmenu', function (e){
                e.preventDefault();
            }).focus();
        },
        close: function() {
            this.$el.remove();
            if (this.contextClose !== undefined){
              this.contextClose();
            }
        }
    });
})();
