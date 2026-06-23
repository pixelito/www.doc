<?php

namespace App\Support;

/**
 * Helpers for fetching attacker-influenced URLs (the editor's image rehost)
 * without opening an SSRF hole.
 */
class Ssrf
{
    /**
     * cURL CURLOPT_RESOLVE entries that pin a URL's host to IPs we already
     * validated as public — so the connection uses those addresses instead of
     * re-resolving DNS, closing the rebinding/TOCTOU window where a hostname
     * answers "public" on the safety check and "internal" on the actual fetch.
     * TLS still validates against the original hostname.
     *
     * Empty when the host is already an IP literal: there's no DNS step to pin.
     *
     * @param  string[]  $ips  public IPs the host resolved to during validation
     * @return string[]  e.g. ['example.com:443:93.184.216.34,2606:2800::1']
     */
    public static function resolvePin(string $url, array $ips): array
    {
        $host = (string) parse_url($url, PHP_URL_HOST);
        $literal = trim($host, '[]');

        if ($host === '' || $ips === [] || filter_var($literal, FILTER_VALIDATE_IP)) {
            return [];
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $port = (int) (parse_url($url, PHP_URL_PORT) ?: ($scheme === 'https' ? 443 : 80));

        return ["{$host}:{$port}:".implode(',', $ips)];
    }
}
