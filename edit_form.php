<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Form for editing BbCoChat block instances.
 *
 * @package   block_bbcochat
 * @copyright 2022 David Herney Bernal - cirano
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Form for editing BbCoChat block instances.
 *
 * @copyright 2022 David Herney Bernal - cirano
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class block_bbcochat_edit_form extends block_edit_form {

    protected function specific_definition($mform) {
        global $CFG, $DB;

        // Fields for editing HTML block title and contents.
        $mform->addElement('header', 'configheader', get_string('blocksettings', 'block'));

        $mform->addElement('text', 'config_title', get_string('configtitle', 'block_html'));
        $mform->setType('config_title', PARAM_TEXT);

        $chats = $DB->get_records_menu('chat', array('course' => $this->page->course->id), 'name', 'id, name');

        if (empty($chats)) {
            $mform->addElement('static', 'nochatwarning', get_string('nochatwarning', 'block_bbcochat'),
                    get_string('nochatwarning', 'block_bbcochat'));
        } else {
            core_collator::asort($chats);
            foreach ($chats as $id => $name) {
                $chats[$id] = strip_tags(format_string($name));
            }
            $mform->addElement('select', 'config_chatconnected',
                    get_string('config_chatconnected', 'block_bbcochat'), $chats);
        }

    }

}
