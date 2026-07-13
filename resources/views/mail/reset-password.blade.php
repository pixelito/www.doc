@extends('mail.layout')

@section('content')
    <h1 style="margin:0 0 12px;font-size:18px;color:#2C2C2C;">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5A5A5A;">
        A password reset was requested for the account using this address.
        Click the button below to choose a new password.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
            <td style="background:#4B6840;border-radius:6px;">
                <a href="{{ $url }}" style="display:inline-block;padding:10px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Reset password
                </a>
            </td>
        </tr>
    </table>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#5A5A5A;">
        This link expires in {{ $expires }} minutes. If you didn't request a
        reset, no action is needed — your password stays as it is.
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8E938E;">
        If the button doesn't work, copy this address into your browser:<br>
        <a href="{{ $url }}" style="color:#4B6840;word-break:break-all;">{{ $url }}</a>
    </p>
@endsection

@section('footer', 'password reset requested for this address')
