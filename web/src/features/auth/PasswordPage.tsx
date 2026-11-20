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
    try {
      await authApi.changePassword(session.token, { old_password: currentPassword, new_password: password, confirm_password: confirmPassword });
      await signOut().catch(() => undefined);
      navigate('/login', { replace: true, state: { message: 'Đổi mật khẩu thành công. Hãy đăng nhập lại.' } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật mật khẩu.');
    } finally { setSaving(false); }
  }

  return (
    <div className="password-page">
      <div className="detail-back"><Link to="/app/profile"><Icon name="arrow" size={16} className="back-arrow" />Thông tin cá nhân</Link></div>
      <PageHeader eyebrow="BẢO MẬT" title="Đổi mật khẩu" description="Sau khi đổi thành công, bạn cần đăng nhập lại bằng mật khẩu mới." />
      <Panel className="password-panel">
        <aside className="password-guide">
          <span className="password-guide__icon"><Icon name="shield" size={28} /></span>
          <span className="password-guide__eyebrow">BẢO VỆ TÀI KHOẢN</span>
          <h2>Mật khẩu an toàn,<br />an tâm làm việc.</h2>
          <p>Sử dụng mật khẩu riêng cho tài khoản May Day của bạn.</p>
          <ul>
            <li className={password.length >= 6 ? 'is-met' : ''}><Icon name="check" size={15} />Tối thiểu 6 ký tự</li>
            <li className={password && password !== currentPassword ? 'is-met' : ''}><Icon name="check" size={15} />Khác mật khẩu hiện tại</li>
            <li className={confirmPassword && password === confirmPassword ? 'is-met' : ''}><Icon name="check" size={15} />Xác nhận mật khẩu trùng khớp</li>
          </ul>
          <div className="password-guide__note"><Icon name="lock" size={16} /><span>Không chia sẻ mật khẩu hoặc mã xác minh với người khác.</span></div>
        </aside>
        <form className="password-form" onSubmit={(event) => void submit(event)}>
          <TextField label="Mật khẩu hiện tại" name="current-password" icon="lock" trailingAction={toggle('current')} type={visible.current ? 'text' : 'password'} placeholder="Nhập mật khẩu đang sử dụng" disabled={saving} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <TextField label="Mật khẩu mới" name="new-password" icon="lock" trailingAction={toggle('new')} type={visible.new ? 'text' : 'password'} placeholder="Nhập mật khẩu mới" disabled={saving} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <TextField label="Xác nhận mật khẩu mới" name="confirm-password" icon="lock" trailingAction={toggle('confirm')} type={visible.confirm ? 'text' : 'password'} placeholder="Nhập lại mật khẩu mới" disabled={saving} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
          {error ? <div className="form-alert" role="alert"><Icon name="alert" size={18} />{error}</div> : null}
          <div className="password-form__actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => navigate('/app/profile')}>Hủy</Button><Button permission={['PUT', '/auth/change-password']} type="submit" icon={<Icon name="check" size={16} />} disabled={saving}>{saving ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</Button></div>
        </form>
      </Panel>
    </div>
  );
}
