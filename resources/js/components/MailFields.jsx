import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const selectCls =
    'mt-1 h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm text-foreground disabled:cursor-not-allowed';

// Shared SMTP form fields — used by the setup wizard's mail step and the admin
// Email settings tab. Flat data shape: host, port, encryption, username,
// password, from_address, from_name. `setField(name, value)` updates one field;
// `errors` is keyed by field name; `passwordSet` shows a "saved" placeholder.
export default function MailFields({ data, setField, errors = {}, passwordSet = false }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                    <Label htmlFor="mail-host">SMTP host <span className="text-danger">*</span></Label>
                    <Input id="mail-host" value={data.host}
                        onChange={(e) => setField('host', e.target.value)}
                        placeholder="smtp.company.com" className="mt-1" />
                    {errors.host && <p className="mt-1 text-xs text-danger">{errors.host}</p>}
                </div>
                <div>
                    <Label htmlFor="mail-port">Port <span className="text-danger">*</span></Label>
                    <Input id="mail-port" type="number" min={1} max={65535} value={data.port}
                        onChange={(e) => setField('port', e.target.value)} className="mt-1" />
                    {errors.port && <p className="mt-1 text-xs text-danger">{errors.port}</p>}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="mail-username">SMTP username</Label>
                    <Input id="mail-username" value={data.username}
                        onChange={(e) => setField('username', e.target.value)}
                        autoComplete="off" className="mt-1" />
                    {errors.username && <p className="mt-1 text-xs text-danger">{errors.username}</p>}
                </div>
                <div>
                    <Label htmlFor="mail-password">SMTP password</Label>
                    <Input id="mail-password" type="password" value={data.password}
                        onChange={(e) => setField('password', e.target.value)}
                        autoComplete="new-password"
                        placeholder={passwordSet ? '•••••••• (saved)' : ''} className="mt-1" />
                    {errors.password && <p className="mt-1 text-xs text-danger">{errors.password}</p>}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div>
                    <Label htmlFor="mail-encryption">Encryption</Label>
                    <select id="mail-encryption" value={data.encryption}
                        onChange={(e) => setField('encryption', e.target.value)} className={selectCls}>
                        <option value="tls">TLS</option>
                        <option value="ssl">SSL</option>
                        <option value="none">None</option>
                    </select>
                </div>
                <div>
                    <Label htmlFor="mail-from">From address <span className="text-danger">*</span></Label>
                    <Input id="mail-from" type="email" value={data.from_address}
                        onChange={(e) => setField('from_address', e.target.value)}
                        placeholder="docs@company.com" className="mt-1" />
                    {errors.from_address && <p className="mt-1 text-xs text-danger">{errors.from_address}</p>}
                </div>
                <div>
                    <Label htmlFor="mail-from-name">From name</Label>
                    <Input id="mail-from-name" value={data.from_name}
                        onChange={(e) => setField('from_name', e.target.value)} className="mt-1" />
                    {errors.from_name && <p className="mt-1 text-xs text-danger">{errors.from_name}</p>}
                </div>
            </div>
        </div>
    );
}
