import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Modal } from '@/features/operations/shared';
import { useAuth } from './auth-context';
import { authApi } from './auth-api';

type ChangePasswordFormProps = {
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
};

export function ChangePasswordForm({ onCancel, onBusyChange }: ChangePasswordFormProps) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const toggle = (field: string) => <button className="password-visibility" type="button" aria-label={`${visible[field] ? 'Ẩn' : 'Hiện'} ${field === 'current' ? 'mật khẩu hiện tại' : field === 'new' ? 'mật khẩu mới' : 'xác nhận mật khẩu'}`} aria-pressed={!!visible[field]} onClick={() => setVisible(previous => ({ ...previous, [field]: !previous[field] }))}><Icon name={visible[field] ? 'eyeOff' : 'eye'} size={18} /></button>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!session || saving) return;
    if (password.length < 6) { setError('Mật khẩu mới cần có ít nhất 6 ký tự.'); return; }
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (password === currentPassword) { setError('Mật khẩu mới cần khác mật khẩu hiện tại.'); return; }
    setSaving(true);
    onBusyChange?.(true);
    try {
      await authApi.changePassword(session.token, { old_password: currentPassword, new_password: password, confirm_password: confirmPassword });
      await signOut().catch(() => undefined);
      navigate('/login', { replace: true, state: { message: 'Đổi mật khẩu thành công. Hãy đăng nhập lại.' } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật mật khẩu.');
    } finally { setSaving(false); onBusyChange?.(false); }
  }

  return (
<form className="password-form" onSubmit={(event) => void submit(event)}>
          <TextField label="Mật khẩu hiện tại" name="current-password" icon="lock" trailingAction={toggle('current')} type={visible.current ? 'text' : 'password'} placeholder="Nhập mật khẩu đang sử dụng" disabled={saving} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <TextField label="Mật khẩu mới" name="new-password" icon="lock" trailingAction={toggle('new')} type={visible.new ? 'text' : 'password'} placeholder="Nhập mật khẩu mới" disabled={saving} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <TextField label="Xác nhận mật khẩu mới" name="confirm-password" icon="lock" trailingAction={toggle('confirm')} type={visible.confirm ? 'text' : 'password'} placeholder="Nhập lại mật khẩu mới" disabled={saving} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
          <ul className="change-password-checks" aria-label="Yêu cầu mật khẩu">
            <li className={password.length >= 6 ? 'is-met' : ''}><Icon name="check" size={15} />Tối thiểu 6 ký tự</li>
            <li className={password && password !== currentPassword ? 'is-met' : ''}><Icon name="check" size={15} />Khác mật khẩu hiện tại</li>
            <li className={confirmPassword && password === confirmPassword ? 'is-met' : ''}><Icon name="check" size={15} />Xác nhận mật khẩu trùng khớp</li>
          </ul>
          {error ? <div className="form-alert" role="alert"><Icon name="alert" size={18} />{error}</div> : null}
          <div className="password-form__actions"><Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>Hủy</Button><Button permission={['PUT', '/auth/change-password']} type="submit" icon={<Icon name="check" size={16} />} disabled={saving}>{saving ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</Button></div>
        </form>
  );
}

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Đổi mật khẩu" onClose={onClose} busy={busy}>
      <div className="change-password-dialog">
        <p className="change-password-description">Sau khi đổi mật khẩu, bạn sẽ đăng nhập lại để tiếp tục sử dụng.</p>
        <ChangePasswordForm onCancel={onClose} onBusyChange={setBusy} />
      </div>
    </Modal>
  );
}
