<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A minimal "your SMTP works" message, sent by the setup wizard and the admin
 * Email settings tab. No Blade view — the body is an inline HTML string so the
 * mailable carries no template dependency.
 */
class TestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $fromAddress,
        public string $fromName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address($this->fromAddress, $this->fromName),
            subject: 'Test email from ' . config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: '<p>This is a test email confirming your SMTP settings are working.</p>'
                . '<p>If you received this, password resets and notifications will be delivered.</p>',
        );
    }
}
