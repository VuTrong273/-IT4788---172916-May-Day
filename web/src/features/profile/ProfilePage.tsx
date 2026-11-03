import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { useAuth } from '@/features/auth/auth-context';
import { getProfile, updateProfile } from '@/features/auth/auth-api';
import { roleFromId, roleLabel } from '@/features/auth/auth-types';

type Profile = {
  user_id: number;
  full_name: string;
  phone: string;
  recovery_email?: string | null;
  role_id: number;
  gender?: string | null;
  year_of_birth?: number | null;
};

export function ProfilePage() {
  const { session, updateUserName } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    if (!session) return;
    getProfile<Profile>(session.token).then((data) => {
      if (active) { setProfile(data); setName(data.full_name); }
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Không tải được hồ sơ.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !name.trim()) { setError('Họ và tên không được để trống.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const updated = await updateProfile<Profile>(session.token, { full_name: name.trim() });
      setProfile(updated); setName(updated.full_name); updateUserName(updated.full_name); setEditing(false); setSuccess('Đã lưu hồ sơ của bạn.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật hồ sơ.');
    } finally { setSaving(false); }
  }

  const role = profile ? roleFromId(profile.role_id) : null;

  return (
    <>
      <PageHeader eyebrow="TÀI KHOẢN" title="Hồ sơ cá nhân" description="Xem và cập nhật thông tin tài khoản nhân viên." />
      {error ? <div className="form-alert page-alert" role="alert"><Icon name="alert" size={18} />{error}<button onClick={() => window.location.reload()}>Tải lại</button></div> : null}
      {success ? <div className="success-alert" role="status"><Icon name="check" size={17} />{success}</div> : null}
      {loading ? <div className="detail-skeleton"><span /><span /><span /></div> : profile ? <div className="profile-grid">
        <Panel title="Thông tin cá nhân" action={editing ? undefined : <Button size="small" variant="secondary" onClick={() => { setEditing(true); setSuccess(''); }}>Chỉnh sửa</Button>}>
          {editing ? <form className="profile-form" onSubmit={(event) => void save(event)}>
            <label className="field"><span className="field__label">Họ và tên</span><span className="field__control"><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></span></label>
            <div className="profile-form__actions"><Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button><Button type="button" variant="quiet" onClick={() => { setName(profile.full_name); setEditing(false); }}>Hủy</Button></div>
          </form> : <div className="detail-fields profile-fields">
            <div><span className="detail-label">Họ và tên</span><strong>{profile.full_name}</strong></div>
            <div><span className="detail-label">Số điện thoại</span><strong>{profile.phone}</strong></div>
            <div><span className="detail-label">Email khôi phục</span><strong>{profile.recovery_email || 'Chưa thiết lập'}</strong></div>
            <div><span className="detail-label">Vai trò</span><strong>{role ? roleLabel(role) : 'Nhân viên'}</strong></div>
            {profile.year_of_birth ? <div><span className="detail-label">Năm sinh</span><strong>{profile.year_of_birth}</strong></div> : null}
          </div>}
        </Panel>
        <Panel className="profile-security"><div className="profile-security__icon"><Icon name="lock" size={20} /></div><div><h2>Bảo mật tài khoản</h2><p>Đổi mật khẩu định kỳ để giữ an toàn cho tài khoản làm việc.</p></div><Link className="button button--secondary" to="/app/profile/password">Đổi mật khẩu</Link></Panel>
      </div> : null}
    </>
  );
}
