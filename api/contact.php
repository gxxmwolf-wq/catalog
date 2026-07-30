<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://rxde.online',
    'https://www.rxde.online',
    'https://rxdeinfo.com',
    'https://www.rxdeinfo.com',
    'http://localhost:8000',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$configPath = __DIR__ . '/../private/telegram_config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Config file not found'], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configPath;
$token = trim((string)($config['telegram_token'] ?? ''));
$chatId = trim((string)($config['telegram_chat_id'] ?? ''));

if ($token === '' || $chatId === '') {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Telegram config is incomplete'], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE);
    exit;
}

$contact = trim((string)($data['contact'] ?? ''));
$context = trim((string)($data['context'] ?? ''));
$source = trim((string)($data['source'] ?? 'RXDE'));
$pageUrl = trim((string)($data['page_url'] ?? ''));
$legacyText = trim((string)($data['text'] ?? ''));

if ($legacyText === '' && $contact === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Contact is required'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($legacyText !== '') {
    $message = $legacyText;
} else {
    $lines = ['Новый запрос', '', 'Источник: ' . ($source ?: 'Не указан'), 'Контакт: ' . $contact];
    if ($context !== '') $lines[] = 'Детали: ' . $context;
    if ($pageUrl !== '') $lines[] = 'Страница: ' . $pageUrl;
    $message = implode("\n", $lines);
}

$ch = curl_init('https://api.telegram.org/bot' . $token . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'chat_id' => $chatId,
        'text' => $message,
        'disable_web_page_preview' => 'true',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 20,
]);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response ?: '', true);
if ($httpCode < 200 || $httpCode >= 300 || !is_array($result) || ($result['ok'] ?? false) !== true) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Telegram rejected request'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
