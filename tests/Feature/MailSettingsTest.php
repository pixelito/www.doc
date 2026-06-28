<?php

use App\Mail\TestMail;
use App\Support\MailSettings;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

/** A full, valid SMTP payload with optional overrides. */
function mailPayload(array $overrides = []): array
{
    return array_replace([
        'host'         => 'smtp.acme.test',
        'port'         => 587,
        'encryption'   => 'tls',
        'username'     => 'mailer',
        'password'     => 'secret',
        'from_address' => 'docs@acme.test',
        'from_name'    => 'Acme Docs',
    ], $overrides);
}

test('non-admins cannot reach the email settings', function () {
    login(null, 'editor');

    $this->get('/admin/settings/mail')->assertForbidden();
    $this->patch('/admin/settings/mail', mailPayload())->assertForbidden();
});

test('an admin can view and save email settings', function () {
    login();

    $this->get('/admin/settings/mail')->assertOk()->assertInertia(
        fn (Assert $page) => $page->component('Settings/Mail')->has('settings'),
    );

    $this->patch('/admin/settings/mail', mailPayload(['port' => 2525, 'encryption' => 'ssl']))
        ->assertRedirect()->assertSessionHasNoErrors();

    expect(MailSettings::get()['host'])->toBe('smtp.acme.test')
        ->and(MailSettings::get()['port'])->toBe(2525)
        ->and(MailSettings::password())->toBe('secret');
});

test('a blank password preserves the stored one', function () {
    login();
    MailSettings::save(mailPayload(['password' => 'original']));

    $this->patch('/admin/settings/mail', mailPayload(['password' => '']))
        ->assertRedirect()->assertSessionHasNoErrors();

    expect(MailSettings::password())->toBe('original');
});

test('forDisplay never leaks the SMTP password', function () {
    MailSettings::save(mailPayload(['password' => 'topsecret']));

    $display = MailSettings::forDisplay();

    expect($display)->not->toHaveKey('password')
        ->and($display['password_set'])->toBeTrue()
        ->and($display['host'])->toBe('smtp.acme.test');
});

test('configured SMTP settings drive the default mailer', function () {
    MailSettings::save(mailPayload(['port' => 2525, 'encryption' => 'ssl']));

    MailSettings::applyToMailer();

    expect(config('mail.default'))->toBe('smtp')
        ->and(config('mail.mailers.smtp.host'))->toBe('smtp.acme.test')
        ->and(config('mail.mailers.smtp.port'))->toBe(2525)
        ->and(config('mail.mailers.smtp.encryption'))->toBe('ssl')
        ->and(config('mail.from.address'))->toBe('docs@acme.test');
});

test('an unconfigured mailer is left untouched', function () {
    config(['mail.default' => 'log']);

    MailSettings::applyToMailer(); // no host set → no-op

    expect(config('mail.default'))->toBe('log');
});

test('the test-email endpoint sends through the entered settings', function () {
    login();
    Mail::fake();

    $this->post('/admin/settings/mail/test', mailPayload(['to' => 'me@acme.test']))
        ->assertRedirect()->assertSessionHas('success');

    Mail::assertSent(TestMail::class);
});
