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

Espo.define('views/email/record/detail', 'views/record/detail', function (Dep) {

    return Dep.extend({

        sideView: 'Email.Record.DetailSide',

        layoutNameConfigure: function () {
            if (!this.model.isNew()) {
                var isRestricted = false;

                if (this.model.get('status') == 'Sent') {
                    isRestricted = true;
                }

                if (this.model.get('status') == 'Archived') {
                    if (this.model.get('createdById') == 'system' || !this.model.get('createdById')) {
                        isRestricted = true;
                    }
                }
                if (isRestricted) {
                    this.layoutName += 'Restricted';
                }
                this.isRestricted = isRestricted;
            }
        },

        init: function () {
            Dep.prototype.init.call(this);

            this.layoutNameConfigure();
        },

        setup: function () {
            Dep.prototype.setup.call(this);

            this.listenTo(this.model, 'sync', function () {
                if (!this.model.get('isRead')) {
                    this.model.set({
                        isRead: true
                    });
                }
            }, this);

            if (this.model.get('isHtml') && this.model.get('bodyPlain')) {
                this.dropdownItemList.push({
                    'label': 'Show Plain Text',
                    'name': 'showBodyPlain'
                });
            }

            if (this.model.get('isUsers')) {
                this.dropdownItemList.push({
                    'label': 'Mark as Important',
                    'name': 'markAsImportant',
                    'hidden': this.model.get('isImportant')
                });
                this.dropdownItemList.push({
                    'label': 'Mark as Not Important',
                    'name': 'markAsNotImportant',
                    'hidden': !this.model.get('isImportant')
                });
            }

            this.listenTo(this.model, 'change:isImportant', function () {
                if (this.model.get('isImportant')) {
                    this.hideActionItem('markAsImportant');
                    this.showActionItem('markAsNotImportant');
                } else {
                    this.hideActionItem('markAsNotImportant');
                    this.showActionItem('markAsImportant');
                }
            }, this);
        },

        actionMarkAsImportant: function () {
            $.ajax({
                url: 'Email/action/markAsImportant',
                type: 'POST',
                data: JSON.stringify({
                    id: this.model.id
                })
            });
            this.model.set('isImportant', true);
        },

        actionMarkAsNotImportant: function () {
            $.ajax({
                url: 'Email/action/markAsNotImportant',
                type: 'POST',
                data: JSON.stringify({
                    id: this.model.id
                })
            });
            this.model.set('isImportant', false);
        },

        actionShowBodyPlain: function () {
            this.createView('bodyPlain', 'Email.Modals.BodyPlain', {
                model: this.model
            }, function (view) {
                view.render();
            }.bind(this));
        },

        handleAttachmentField: function () {
            if ((this.model.get('attachmentsIds') || []).length == 0) {
                this.hideField('attachments');
            } else {
                this.showField('attachments');
            }
        },

        handleCcField: function () {
            if (!this.model.get('cc')) {
                this.hideField('cc');
            } else {
                this.showField('cc');
            }
        },

        handleBccField: function () {
            if (!this.model.get('bcc')) {
                this.hideField('bcc');
            } else {
                this.showField('bcc');
            }
        },

        handleRepliesField: function () {
            if ((this.model.get('repliesIds') || []).length == 0) {
                this.hideField('replies');
            } else {
                this.showField('replies');
            }
            if (!this.model.get('repliedId')) {
                this.hideField('replied');
            } else {
                this.showField('replied');
            }
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            if (this.model.get('status') === 'Draft') {
                this.setFieldReadOnly('dateSent');
            }

            if (this.isRestricted) {
                this.handleAttachmentField();
                this.listenTo(this.model, 'change:attachmentsIds', function () {
                    this.handleAttachmentField();
                }, this);

                this.handleCcField();
                this.listenTo(this.model, 'change:cc', function () {
                    this.handleCcField();
                }, this);
                this.handleBccField();
                this.listenTo(this.model, 'change:bcc', function () {
                    this.handleBccField();
                }, this);

                this.handleRepliesField();
                this.listenTo(this.model, 'change:repliesIds', function () {
                    this.handleRepliesField();
                }, this);
            }
        },

        send: function () {
            var model = this.model;
            model.set('status', 'Sending');

            var afterSend = function () {
                Espo.Ui.success(this.translate('emailSent', 'messages', 'Email'));
                this.trigger('after:send');
            };

            this.once('after:save', afterSend, this);
            this.once('cancel:save', function () {
                this.off('after:save', afterSend);
            }, this);

            this.once('before:save', function () {
                Espo.Ui.notify(this.translate('Sending...', 'labels', 'Email'));
            }, this);

            this.save();
        },

    });
});

