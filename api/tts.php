<?php
/**
 * ElevenLabs TTS Proxy
 * Generates speech audio for words and returns as base64-encoded MP3
 */

// Disable all output that could break JSON (CRITICAL!)
error_reporting(0); // Disable error reporting completely
ini_set('display_errors', '0'); // Don't display errors
ini_set('log_errors', '1'); // Log errors instead
ini_set('error_log', '/tmp/elevenlabs_tts_errors.log'); // Log to file

// Set response headers (must be before any output)
header('Access-Control-Allow-Origin: *'); // Allow all origins
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Max-Age: 86400'); // Cache preflight for 24 hours
header('Content-Type: application/json');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get API key from environment or config
// IMPORTANT: Store your API key in a .env file or config outside the public directory
// For now, you can set it here temporarily (but move it later!)
$apiKey = getenv('ELEVENLABS_API_KEY');
if (!$apiKey) {
    // Fallback: check for config file
    $configFile = __DIR__ . '/../config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
        $apiKey = defined('ELEVENLABS_API_KEY') ? ELEVENLABS_API_KEY : '';
    }
}

if (empty($apiKey)) {
    http_response_code(500);
    echo json_encode(['error' => 'API key not configured']);
    exit;
}

// Get request data
$input = json_decode(file_get_contents('php://input'), true);
$text = isset($input['text']) ? trim($input['text']) : '';

if (empty($text)) {
    http_response_code(400);
    echo json_encode(['error' => 'Text is required']);
    exit;
}

// Validate text (max 500 characters for safety)
if (strlen($text) > 500) {
    http_response_code(400);
    echo json_encode(['error' => 'Text too long (max 500 characters)']);
    exit;
}

// ElevenLabs API configuration
// Voice ID: Rachel (child-friendly, clear pronunciation)
// You can change this to other voices from ElevenLabs
$voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Rachel voice
$url = "https://api.elevenlabs.io/v1/text-to-speech/{$voiceId}";

// Request payload
$payload = [
    'text' => $text,
    'model_id' => 'eleven_turbo_v2_5', // Updated model for free tier
    'voice_settings' => [
        'stability' => 0.5,
        'similarity_boost' => 0.5,
        'style' => 0.0,
        'use_speaker_boost' => true
    ]
];

// Make API request using file_get_contents (no cURL required!)
$options = [
    'http' => [
        'method' => 'POST',
        'header' => [
            'Content-Type: application/json',
            'xi-api-key: ' . $apiKey
        ],
        'content' => json_encode($payload),
        'timeout' => 30,
        'ignore_errors' => true // Get response even on error codes
    ]
];

$context = stream_context_create($options);
$response = @file_get_contents($url, false, $context);

// Get HTTP response code
$httpCode = 200;
if (isset($http_response_header)) {
    foreach ($http_response_header as $header) {
        if (preg_match('/^HTTP\/\d\.\d\s+(\d+)/', $header, $matches)) {
            $httpCode = (int)$matches[1];
            break;
        }
    }
}

// Handle errors
if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Network error: Failed to connect to ElevenLabs API']);
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    // Try to parse error from ElevenLabs
    $errorData = json_decode($response, true);
    $errorMsg = isset($errorData['detail']['message'])
        ? $errorData['detail']['message']
        : 'TTS generation failed';
    echo json_encode(['error' => $errorMsg]);
    exit;
}

// Success! Return audio as base64 for easy IndexedDB storage
echo json_encode([
    'success' => true,
    'audio' => base64_encode($response),
    'text' => $text
]);
