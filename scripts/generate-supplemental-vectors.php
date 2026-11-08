<?php

// Synthetic public fixtures only. Reads the backend prototype, never boots Laravel.
// No private key is exported or saved; no production tables or configuration are used.
require __DIR__.'/../../oidevs-examenes-backend/vendor/autoload.php';

use App\Services\QrV3\QrV3KeyRing;
use App\Services\QrV3\QrV3Service;
use Tests\Support\QrV3TestKeys;

$key = QrV3TestKeys::rsa();
$public = openssl_pkey_get_details($key)['key'];
$kid = 'phase2-public-fixtures';
$issuer = 'https://eida.example.test';
$audience = 'eida-control-qr';
$clock = 1893456000;
$prototype = new QrV3Service(new QrV3KeyRing([$kid => $public], $kid, $key), $issuer, $audience);
$valid = $prototype->issue('f1cf8459-ae26-4def-9a24-294629314c17', 101, 42, $clock, $clock, $clock + 3600);
$parts = explode('.', $valid);
$claims = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true, flags: JSON_THROW_ON_ERROR);
$header = ['alg' => 'RS256', 'kid' => $kid, 'typ' => QrV3Service::TYPE];
$encode = fn ($raw) => rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
$sign = function (array $h, array $c, ?string $rawPayload = null) use ($encode, $key): string {
    $input = $encode(json_encode($h, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)).'.'
        .$encode($rawPayload ?? json_encode($c, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    openssl_sign($input, $signature, $key, OPENSSL_ALGO_SHA256);
    return $input.'.'.$encode($signature);
};
$cases = [];
$add = function ($name, $token, $reason = null) use (&$cases, $clock) {
    $cases[] = ['name' => $name, 'token' => $token, 'student_id' => 101, 'exam_id' => 42,
        'now' => $clock + 60, 'valid' => $reason === null, 'reason' => $reason];
};
$add('supplemental-valid-php', $valid);
$missing = $claims;
unset($missing['exp']);
$add('signed-missing-exp', $sign($header, $missing), 'CLAIMS_INVALID');
$add('signed-wrong-version', $sign($header, array_replace($claims, ['v' => 2])), 'CLAIMS_INVALID');
$add('signed-extra-personal-field', $sign($header, $claims + ['sis_code' => 'SYNTHETIC']), 'CLAIMS_INVALID');
$add('signed-wrong-issuer', $sign($header, array_replace($claims, ['iss' => 'https://wrong.example.test'])), 'CLAIMS_INVALID');
$add('signed-wrong-audience', $sign($header, array_replace($claims, ['aud' => 'wrong'])), 'CLAIMS_INVALID');
$add('signed-string-exp', $sign($header, array_replace($claims, ['exp' => (string) $claims['exp']])), 'CLAIMS_INVALID');
$add('signed-zero-subject', $sign($header, array_replace($claims, ['sub' => '0'])), 'CLAIMS_INVALID');
$add('signed-noncanonical-id', $sign($header, array_replace($claims, ['exam_id' => '042'])), 'CLAIMS_INVALID');
$add('signed-oversized-id', $sign($header, array_replace($claims, ['sub' => '9223372036854775808'])), 'CLAIMS_INVALID');
$add('signed-time-order', $sign($header, array_replace($claims, ['nbf' => $clock - 1])), 'CLAIMS_INVALID');
$add('signed-long-lifetime', $sign($header, array_replace($claims, ['exp' => $clock + 172801])), 'CLAIMS_INVALID');
$raw = json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
$add('signed-duplicate-claim', $sign($header, $claims, str_replace('"v":3', '"v":3,"v":3', $raw)), 'FORMAT_INVALID');
$add('signed-noncompact-json', $sign($header, $claims, str_replace('"v":3', '"v": 3', $raw)), 'FORMAT_INVALID');
$add('algorithm-none', $sign(array_replace($header, ['alg' => 'none']), $claims), 'HEADER_INVALID');
$add('wrong-typ', $sign(array_replace($header, ['typ' => 'JWT']), $claims), 'HEADER_INVALID');
$add('unexpected-jku', $sign($header + ['jku' => 'https://untrusted.example.test/key'], $claims), 'HEADER_INVALID');
$add('base64url-padding', $valid.'=', 'FORMAT_INVALID');
$add('malformed-segments', 'one.two', 'FORMAT_INVALID');
$output = ['format' => 'EIDA-QR-v3-phase2-supplemental', 'kid' => $kid, 'issuer' => $issuer, 'audience' => $audience,
    'public_key_pem' => $public, 'cases' => $cases, 'warning' => 'Synthetic public material. Private key discarded.'];
$path = __DIR__.'/../src/features/qr/fixtures/supplemental-vectors.json';
file_put_contents($path, json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n");
echo 'Wrote '.count($cases)." supplemental public cases. No private key retained.\n";

