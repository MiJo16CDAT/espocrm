/************************************************************************
 * This file is part of EspoCRM.
 *
 * EspoCRM - Open Source CRM application.
 * Copyright (C) 2014-2015 Yuri Kuznetsov, Taras Machyshyn, Oleksiy Avramenko
 * Website: http://www.espocrm.com
 *
 * EspoCRM is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * EspoCRM is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EspoCRM. If not, see http://www.gnu.org/licenses/.
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License version 3,
 * these Appropriate Legal Notices must retain the display of the "EspoCRM" word.
 ************************************************************************/

Espo.define('views/dashlet', 'view', function (Dep) {

    return Dep.extend({

        name: null,

        id: null,

        elId: null,

        template: 'dashlet',

        data: function () {
            return {
                name: this.name,
                id: this.id,
                title: this.getOption('title'),
                isDoubleHeight: this.getOption('isDoubleHeight'),
                actionList: (this.getView('body') || {}).actionList || []
            };
        },

        events: {
            'click .action': function (e) {
                var $target = $(e.currentTarget);
                var action = $target.data('action');
                var data = $target.data();
                if (action) {
                    var method = 'action' + Espo.Utils.upperCaseFirst(action);
                    if (typeof this[method] == 'function') {
                        e.preventDefault();
                        this[method].call(this, data);
                    } else {
                        var bodyView = this.getView('body');
                        if (typeof bodyView[method] == 'function') {
                            e.preventDefault();
                            bodyView[method].call(bodyView, data);
                        }
                    }
                }
            },
        },

        setup: function () {
            this.name = this.options.name;
            this.id = this.options.id;

            var bodySelector = '#dashlet-' + this.id + ' .dashlet-body';
            var view = this.getMetadata().get('dashlets.' + this.name + '.view') || 'Dashlets.' + this.name;

            this.createView('body', view, {el: bodySelector, id: this.id});
        },

        refresh: function () {
            this.getView('body').actionRefresh();
        },

        actionRefresh: function () {
            this.refresh();
        },

        actionOptions: function () {
            var optionsView = this.getView('body').optionsView;
            this.createView('options', optionsView, {
                name: this.name,
                optionsData: this.getOptionsData(),
                fields: this.getView('body').optionsFields,
            }, function (view) {
                view.render();
            });
        },

        getOptionsData: function () {
            return this.getView('body').optionsData;
        },

        getOption: function (key) {
            return this.getView('body').getOption(key);
        },

        actionRemove: function () {
            var dashboard = this.getParentView().getParentView();
            dashboard.removeDashlet(this.options.id);
            this.$el.remove();
            this.remove();
        },
    });
});


