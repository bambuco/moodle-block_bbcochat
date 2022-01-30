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
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

class block_bbcochat extends block_base {

    /**
     * Set the initial properties for the block
     */
    function init() {
        $this->title = get_string('pluginname', 'block_bbcochat');
    }

    /**
     * All multiple instances of this block
     * @return bool Returns false
     */
    function instance_allow_multiple() {
        return false;
    }

    function has_config() {
      return true;
    }

    /**
     * Set the applicable formats for this block to all
     * @return array
     */
    function applicable_formats() {
        return array('course' => true);
    }

    function specialization() {
        if (isset($this->config->title)) {
            $this->title = $this->title = format_string($this->config->title, true, ['context' => $this->context]);
        } else {
            $this->title = get_string('newblocktitle', 'block_bbcochat');
        }
    }

    /**
     * Gets the content for this block by grabbing it from $this->page
     *
     * @return object $this->content
     */
    function get_content() {
        if ($this->content !== NULL) {
            return $this->content;
        }

        global $CFG, $USER, $DB, $SESSION;

        $this->content = new stdClass;
        $this->content->text = '';
        $this->content->footer = '';

        $course = $this->page->course;

         if ($course->id == SITEID){
            $this->content->text = get_string('notinsitelevel', 'block_bbcochat');
            return $this->content;
        }

        $chat = null;
        if (!empty($this->config->chatconnected)) {
            $chat = $DB->get_record('chat', ['id' => $this->config->chatconnected]);
        }

        if (!$chat) {
            $coursecontext = context_course::instance($course->id);
            if (has_capability('moodle/course:update', $coursecontext)) {
                $this->content->text = get_string('notchatconfigured', 'block_bbcochat');
            }

            return $this->content;
        }

        if (!$cm = get_coursemodule_from_instance('chat', $chat->id, $course->id)) {
            return $this->content;
        }

        $modinfo = get_fast_modinfo($course);
        $cm = $modinfo->get_cm($cm->id);

        if (!$cm->uservisible || $cm->deletioninprogress) {
            return $this->content;
        }

        $config = ['paths' => ['bbcochatcore' => $CFG->wwwroot . '/blocks/bbcochat/js/bbco-chat']];
        $requirejs = 'require.config(' . json_encode($config) . ')';
        $this->page->requires->js_amd_inline($requirejs);

        $this->page->requires->js_call_amd('block_bbcochat/bbcochat', 'init', array($course->id, $cm->id));
        $this->page->requires->css('/blocks/bbcochat/js/bbco-chat.min.css', true);

        return $this->content;
    }

    /**
     * Serialize and store config data
     */
    function instance_config_save($data, $nolongerused = false) {
        global $DB;

        $cm = get_coursemodule_from_instance('chat', $data->chatconnected, $this->page->course->id);

        $select = $DB->sql_compare_text('param2') . " = " . $DB->sql_compare_text(':context');
        $params = ['context' => 'bbcochat=' . $this->context->id];
        $tepuysetting = $DB->get_record_select('local_tepuy_settings', $select, $params);

        if (!$tepuysetting) {
            // It is the first chat association.
            $params = [
                'cmid' => $cm->id,
                'course' => $this->page->course->id,
                'enabled' => 1,
                'param2' => 'bbcochat=' . $this->context->id
            ];

            $DB->insert_record('local_tepuy_settings', $params);
        } else {
            // It was connected with other chat... update the cmid.
            $params = [
                'id' => $tepuysetting->id,
                'cmid' => $cm->id
            ];
            $DB->update_record('local_tepuy_settings', $params);
        }

        parent::instance_config_save($data, $nolongerused);
    }

    function instance_delete() {
        global $DB;

        $select = $DB->sql_compare_text('param2') . " = " . $DB->sql_compare_text(':context');
        $params = ['context' => 'bbcochat=' . $this->context->id];
        $tepuysetting = $DB->get_record_select('local_tepuy_settings', $select, $params);

        if ($tepuysetting) {
            $DB->delete_records('local_tepuy_settings', ['id' => $tepuysetting->id]);
        }

        return true;
    }

}
