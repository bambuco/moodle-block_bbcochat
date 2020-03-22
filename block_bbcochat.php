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
 * Block BambuCo Chat.
 *
 * @since     3.6
 * @package   block_bbcochat
 * @copyright 2020 David Herney Bernal - cirano
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

class block_bbcochat extends block_base {
    function init() {
        $this->title = get_string('pluginname', 'block_bbcochat');
    }

    function has_config() {
      return false;
    }

    function applicable_formats() {
        return array('course' => true);
    }

    function get_content() {
        if ($this->content !== NULL) {
            return $this->content;
        }

        global $CFG, $USER, $DB, $SESSION;

        $this->content = new stdClass;
        $this->content->text = '';
        $this->content->footer = '';

        $course = $this->page->course;

         if ($course == NULL || !is_object($course) || $course->id == 0 || $course->id == SITEID){
            return $this->content;
        }

        if (!$DB->get_record('chat', array('course' => $course->id, 'name' => 'envivo'))) {
            return $this->content;
        }

        $this->page->requires->js_call_amd('block_bbcochat/bbcochat', 'init', array($course->id));
        $this->page->requires->css('/blocks/bbcochat/js/bbco-chat.min.css', true);

        return $this->content;
    }

}
