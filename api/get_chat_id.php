<?php
declare(strict_types=1);
header('Content-Type: text/plain; charset=utf-8');

$configPath = __DIR__ . '/../private/telegram_config.php';
if (!is_file($configPath)) exit('Не найден private/telegram_config.php');

$config = require $configPath;
$token = trim((string)($config['telegram_token'] ?? ''));
if ($token === '') exit('Токен не указан');

$ch = curl_init('https://api.telegram.org/bot' . $token . '/getUpdates');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response ?: '', true);
$updates = is_array($data) ? ($data['result'] ?? []) : [];
if (!$updates) exit("Сообщений нет. Отправьте боту слово «тест» и обновите страницу.");

$last = end($updates);
$message = $last['message'] ?? $last['edited_message'] ?? null;
$chatId = $message['chat']['id'] ?? null;
if ($chatId === null) exit('chat_id не найден.');

echo 'Ваш chat_id: ' . $chatId . "\n";
echo 'Запишите его в private/telegram_config.php и сразу удалите api/get_chat_id.php.';
