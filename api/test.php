<?php
/**
 * Simple test endpoint to verify PHP setup
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Check if config is loaded
$configExists = file_exists(__DIR__ . '/../config.php');
$apiKeySet = false;

if ($configExists) {
    require_once __DIR__ . '/../config.php';
    $apiKeySet = defined('ELEVENLABS_API_KEY') && !empty(ELEVENLABS_API_KEY) && ELEVENLABS_API_KEY !== 'your-api-key-here';
}

echo json_encode([
    'status' => 'ok',
    'php_version' => phpversion(),
    'config_exists' => $configExists,
    'api_key_configured' => $apiKeySet,
    'curl_available' => function_exists('curl_init'),
    'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    'message' => 'PHP API is working!'
]);
