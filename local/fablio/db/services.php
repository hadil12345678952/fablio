<?php
/**
 * Déclaration du service web externe « fablio-ws » et de ses fonctions.
 *
 * @package    local_fablio
 * @copyright  2026 Fablio
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_fablio_get_site_info' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'get_site_info',
        'description'  => 'Retourne des informations sur le site Moodle et sur le jeton utilisé.',
        'type'         => 'read',
        'capabilities' => 'local/fablio:view',
    ],
    'local_fablio_create_quiz' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'create_quiz',
        'description'  => 'Crée un quiz dans un cours et renvoie ses identifiants.',
        'type'         => 'write',
        'capabilities' => 'local/fablio:manage',
    ],
    'local_fablio_list_quizzes' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'list_quizzes',
        'description'  => 'Liste les quiz d\'un cours.',
        'type'         => 'read',
        'capabilities' => 'local/fablio:view',
    ],
    'local_fablio_create_question' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'create_question',
        'description'  => 'Crée une question dans la banque et l\'ajoute à un quiz.',
        'type'         => 'write',
        'capabilities' => 'local/fablio:manage',
    ],
    'local_fablio_get_quiz_detail' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'get_quiz_detail',
        'description'  => 'Détail d\'un quiz (questions, barème).',
        'type'         => 'read',
        'capabilities' => 'local/fablio:view',
    ],
    'local_fablio_set_quiz_visible' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'set_quiz_visible',
        'description'  => 'Publie ou dépublie un quiz.',
        'type'         => 'write',
        'capabilities' => 'local/fablio:manage',
    ],
    'local_fablio_submit_attempt' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'submit_attempt',
        'description'  => 'Enregistre une tentative d\'élève, la corrige et renvoie la note.',
        'type'         => 'write',
        'capabilities' => 'local/fablio:manage',
    ],
    'local_fablio_get_attempts' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'get_attempts',
        'description'  => 'Tentatives d\'un quiz (résultats).',
        'type'         => 'read',
        'capabilities' => 'local/fablio:view',
    ],
    'local_fablio_get_progress' => [
        'classname'    => 'local_fablio\external',
        'methodname'   => 'get_progress',
        'description'  => 'Progression d\'un élève sur un quiz.',
        'type'         => 'read',
        'capabilities' => 'local/fablio:view',
    ],
];

$services = [
    'fablio-ws' => [
        'functions' => array_keys($functions),
        'restrictedusers' => 1,
        'enabled' => 1,
        'shortname' => 'fablio-ws',
    ],
];
