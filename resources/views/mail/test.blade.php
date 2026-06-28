<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FBFAF5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2C2C2C;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBFAF5;padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E2DFD4;border-radius:8px;overflow:hidden;">
                    <tr>
                        <td style="height:4px;background:#4B6840;"></td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px;">
                            <p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#8E938E;">{{ $appName }}</p>
                            <h1 style="margin:0 0 12px;font-size:18px;color:#2C2C2C;">Email settings test</h1>
                            <p style="margin:0;font-size:14px;line-height:1.6;color:#5A5A5A;">
                                This is a test message confirming your email (SMTP) settings are working.
                                Password resets and notifications will be delivered to your users from now on.
                            </p>
                        </td>
                    </tr>
                </table>
                <p style="margin:16px 0 0;font-size:11px;color:#8E938E;">Sent by {{ $appName }} · automated email settings test</p>
            </td>
        </tr>
    </table>
</body>
</html>
