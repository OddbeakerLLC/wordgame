<?php
/**
 * Google Cloud TTS Proxy
 * Generates speech audio for words and returns as base64-encoded MP3
 */

// Disable all output that could break JSON (CRITICAL!)
error_reporting(0); // Disable error reporting completely
ini_set('display_errors', '0'); // Don't display errors
ini_set('log_errors', '1'); // Log errors instead
ini_set('error_log', '/tmp/google_tts_errors.log'); // Log to file

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
$apiKey = getenv('GOOGLE_TTS_API_KEY');
if (!$apiKey) {
    // Fallback: check for config file
    $configFile = __DIR__ . '/../config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
        $apiKey = defined('GOOGLE_TTS_API_KEY') ? GOOGLE_TTS_API_KEY : '';
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

// Google Cloud TTS API configuration
$url = "https://texttospeech.googleapis.com/v1/text:synthesize?key=" . urlencode($apiKey);

// Use SSML for single letters to get proper letter name pronunciation
$isSingleLetter = strlen($text) === 1 && ctype_alpha($text);

if ($isSingleLetter) {
    $ssml = '<speak><say-as interpret-as="characters">' . htmlspecialchars($text) . '</say-as></speak>';
    $inputField = ['ssml' => $ssml];
} else {
    $inputField = ['text' => $text];
}

// Request payload
$payload = [
    'input' => $inputField,
    'voice' => [
        'languageCode' => 'en-US',
        'name' => 'en-US-Studio-O', // High-quality female voice, child-friendly
        'ssmlGender' => 'FEMALE'
    ],
    'audioConfig' => [
        'audioEncoding' => 'MP3',
        'speakingRate' => 0.95, // Slightly slower for clarity
        'pitch' => 1.0
    ]
];

// Make API request
$options = [
    'http' => [
        'method' => 'POST',
        'header' => [
            'Content-Type: application/json'
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
    echo json_encode(['error' => 'Network error: Failed to connect to Google Cloud TTS API']);
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    // Try to parse error from Google
    $errorData = json_decode($response, true);
    $errorMsg = isset($errorData['error']['message'])
        ? $errorData['error']['message']
        : 'TTS generation failed';
    echo json_encode(['error' => $errorMsg]);
    exit;
}

// Parse Google's response (returns base64 audio content directly)
$responseData = json_decode($response, true);
if (!isset($responseData['audioContent'])) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid response from Google Cloud TTS']);
    exit;
}

// Success! Return audio as base64 for easy IndexedDB storage
echo json_encode([
    'success' => true,
    'audio' => $responseData['audioContent'],
    'text' => $text
]);
