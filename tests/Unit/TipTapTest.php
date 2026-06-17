<?php

use App\Support\TipTap;
use Database\Factories\DocumentFactory;

test('plainText concatenates nested text nodes', function () {
    $doc = DocumentFactory::tiptap('Hello world.');
    expect(TipTap::plainText($doc))->toBe('Hello world.');
});

test('wikiLinkTitles extracts and de-duplicates [[references]]', function () {
    $doc = DocumentFactory::tiptap('See [[Firewall]], [[VPN]] and [[Firewall]] again.');

    expect(TipTap::wikiLinkTitles($doc))->toBe(['Firewall', 'VPN']);
});

test('wikiLinkTitles returns nothing when there are no links', function () {
    expect(TipTap::wikiLinkTitles(DocumentFactory::tiptap('plain text')))->toBe([]);
    expect(TipTap::wikiLinkTitles(null))->toBe([]);
});
