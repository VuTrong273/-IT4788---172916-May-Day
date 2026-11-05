import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from './auth-context';
import { authApi } from './auth-api';

export function PasswordPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!session) return;
    if (password.length < 6) { setError('Mật khẩu mới cần có ít nhất 6 ký tự.'); return; }
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (password === currentPassword) { setError('Mật khẩu mới cần khác mật khẩu hiện tại.'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(session.token, { old_password: currentPassword, new_password: password, confirm_password: confirmPassword });
      await signOut().catch(() => undefined);
      navigate('/login', { replace: true, state: { message: 'Đổi mật khẩu thành công. Hãy đăng nhập lại.' } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật mật khẩu.');
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="detail-back"><Link to="/app/profile"><Icon name="arrow" size={16} className="back-arrow" />Quay lại hồ sơ cá nhân</Link></div>
      <PageHeader eyebrow="BẢO MẬT" title="Đổi mật khẩu" description="Sau khi đổi thành công, bạn cần đăng nhập lại bằng mật khẩu mới." />
      <Panel className="password-panel">
        <form className="password-form" onSubmit={(event) => void submit(event)}>
          <TextField label="Mật khẩu hiện tại" name="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <TextField label="Mật khẩu mới" name="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <TextField label="Xác nhận mật khẩu mới" name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
          {error ? <div className="form-alert" role="alert"><Icon name="alert" size={18} />{error}</div> : null}
          <div className="profile-form__actions"><Button type="submit" disabled={saving}>{saving ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</Button><Link className="button button--quiet" to="/app/profile">Hủy</Link></div>
        </form>
        <div className="privacy-note"><Icon name="lock" size={17} /><span>Không chia sẻ mật khẩu hoặc mã xác minh với người khác.</span></div>
      </Panel>
    </>
  );
}
