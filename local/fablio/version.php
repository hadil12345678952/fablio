<?php
/**
 * Fablio — plugin local Moodle : moteur pédagogique de la plateforme Fablio.
 *
 * Cible : Moodle 4.5 (LTS)  —  PHP 8.1 .. 8.3   (voir README pour 4.4 / 5.x)
 * Le plugin expose des web services sécurisés que Fablio appelle pour créer
 * des quiz, des questions, grader des tentatives et lire les résultats.
 *
 * @package    local_fablio
 * @copyright  2026 Fablio
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$plugin->component = 'local_fablio';
$plugin->version   = 2026010100;
$plugin->requires  = 2024100700; // Moodle 4.5 (LTS).
$plugin->maturity  = MATURITY_STABLE;
$plugin->release   = '1.0.0';
