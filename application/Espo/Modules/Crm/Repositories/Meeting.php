<?php
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

namespace Espo\Modules\Crm\Repositories;

use Espo\ORM\Entity;

class Meeting extends \Espo\Core\ORM\Repositories\RDB
{
    protected function beforeSave(Entity $entity, array $options)
    {
        parent::beforeSave($entity, $options);

        $parentId = $entity->get('parentId');
        $parentType = $entity->get('parentType');
        if (!empty($parentId) || !empty($parentType)) {
            $parent = $this->getEntityManager()->getEntity($parentType, $parentId);
            if (!empty($parent)) {
                $accountId = null;
                if ($parent->getEntityType() == 'Account') {
                    $accountId = $parent->id;
                } else if ($parent->get('accountId')) {
                    $accountId = $parent->get('accountId');
                } else if ($parent->getEntityType() == 'Lead') {
                    if ($parent->get('status') == 'Converted') {
                        if ($parent->get('createdAccountId')) {
                            $accountId = $parent->get('createdAccountId');
                        }
                    }
                }
                if (!empty($accountId)) {
                    $entity->set('accountId', $accountId);
                }
            }
        }

        $assignedUserId = $entity->get('assignedUserId');
        if ($assignedUserId && $entity->has('usersIds')) {
            $usersIds = $entity->get('usersIds');
            if (!is_array($usersIds)) {
                $usersIds = array();
            }
            if (!in_array($assignedUserId, $usersIds)) {
                $usersIds[] = $assignedUserId;
                $entity->set('usersIds', $usersIds);
                $hash = $entity->get('usersNames');
                if ($hash instanceof \StdClass) {
                    $hash->$assignedUserId = $entity->get('assignedUserName');
                    $entity->set('usersNames', $hash);
                }
            }
            if ($entity->isNew()) {
                $currentUserId = $this->getEntityManager()->getUser()->id;
                if (in_array($currentUserId, $usersIds)) {
                    $usersColumns = $entity->get('usersColumns');
                    if (empty($usersColumns)) {
                        $usersColumns = new \StdClass();
                    }
                    if ($usersColumns instanceof \StdClass) {
                        if (!($usersColumns->$currentUserId instanceof \StdClass)) {
                            $usersColumns->$currentUserId = new \StdClass();
                        }
                        if (empty($usersColumns->$currentUserId->status)) {
                            $usersColumns->$currentUserId->status = 'Accepted';
                        }
                    }
                }
            }
        }
    }

    public function getEntityReminders(Entity $entity)
    {
        $pdo = $this->getEntityManager()->getPDO();
        $reminders = array();

        $sql = "
            SELECT id, `seconds`, `type`
            FROM `reminder`
            WHERE
                `entity_type` = ".$pdo->quote($entity->getEntityType())." AND
                `entity_id` = ".$pdo->quote($entity->id)." AND
                `deleted` = 0
                ORDER BY `seconds` ASC
        ";

        $sth = $pdo->prepare($sql);
        $sth->execute();
        $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            $o = new \StdClass();
            $o->seconds = intval($row['seconds']);
            $o->type = $row['type'];
            $reminders[] = $o;
        }

        return $reminders;
    }

    protected function afterSave(Entity $entity, array $options)
    {
        parent::afterSave($entity, $options);

        if (
            $entity->isNew() ||
            $entity->isFieldChanged('assignedUserId') ||
            $entity->isFieldChanged('dateStart') ||
            $entity->has('reminders')
        ) {
            $pdo = $this->getEntityManager()->getPDO();

            $reminderTypeList = $this->getMetadata()->get('entityDefs.Reminder.fields.type.options');

            if (!$entity->has('reminders')) {
                $reminders = $this->getEntityReminders($entity);
            } else {
                $reminders = $entity->get('reminders');
            }

            if (!$entity->isNew()) {
                $sql = "
                    DELETE FROM `reminder`
                    WHERE
                        entity_id = ".$pdo->quote($entity->id)." AND
                        entity_type = ".$pdo->quote($entity->getEntityName())." AND
                        deleted = 0
                ";
                $pdo->query($sql);
            }

            if (empty($reminders) || !is_array($reminders)) return;

            $entityType = $entity->getEntityName();

            $dateStart = $entity->get('dateStart');
            $assignedUserId = $entity->get('assignedUserId');

            if (!$dateStart || !$assignedUserId) {
                $e = $this->get($entity->id);
                if ($e) {
                    $dateStart = $e->get('dateStart');
                    $assignedUserId = $e->get('assignedUserId');
                }
            }

            if (!$dateStart || !$assignedUserId) {
                return;
            }


            $dateStartObj = new \DateTime($dateStart);
            if (!$dateStartObj) {
                return;
            }

            foreach ($reminders as $item) {
                $remindAt = clone $dateStartObj;
                $seconds = intval($item->seconds);
                $type = $item->type;

                if (!in_array($type , $reminderTypeList)) continue;

                $remindAt->sub(new \DateInterval('PT' . $seconds . 'S'));

                $id = uniqid();

                $sql = "
                    INSERT
                    INTO `reminder`
                    (id, entity_id, entity_type, `type`, user_id, remind_at, start_at, `seconds`)
                    VALUES (
                        ".$pdo->quote($id).",
                        ".$pdo->quote($entity->id).",
                        ".$pdo->quote($entityType).",
                        ".$pdo->quote($type).",
                        ".$pdo->quote($assignedUserId).",
                        ".$pdo->quote($remindAt->format('Y-m-d H:i:s')).",
                        ".$pdo->quote($dateStart).",
                        ".$pdo->quote($seconds)."
                    )
                ";
                $pdo->query($sql);

            }
        }
    }
}

