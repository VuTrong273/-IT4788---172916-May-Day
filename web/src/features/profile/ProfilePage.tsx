import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { useAuth } from "@/features/auth/auth-context";
import { getProfile, updateProfile } from "@/features/auth/auth-api";
import { roleFromId, roleLabel } from "@/features/auth/auth-types";

type Profile = {
  user_id: number;
  full_name: string;
  phone: string;
  recovery_email?: string | null;
  role_id: number;
  base_role?: "admin" | "doctor" | "patient" | null;
  gender?: string | null;
  year_of_birth?: number | null;
};

export function ProfilePage() {
  const { session, updateUserName, can } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    if (!session) return;
    getProfile<Profile>(session.token)
      .then((data) => {
        if (active) {
          setProfile(data);
          setName(data.full_name);
          setGender(data.gender ?? "");
        }
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : "Không tải được hồ sơ.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !name.trim()) {
      setError("Họ và tên không được để trống.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateProfile<Profile>(session.token, {
        full_name: name.trim(),
        ...(gender ? { gender } : {}),
      });
      setProfile(updated);
      setName(updated.full_name);
      updateUserName(updated.full_name);
      setEditing(false);
      setSuccess("Đã lưu hồ sơ của bạn.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể cập nhật hồ sơ.",
      );
    } finally {
      setSaving(false);
    }
  }

  const role = profile ? roleFromId(profile) : null;
  const initials = profile?.full_name.trim().split(/\s+/).map(part => part[0]).slice(-2).join('').toUpperCase() || 'MD';

  return (
    <>
      <PageHeader
        eyebrow="TÀI KHOẢN"
        title="Thông tin cá nhân"
        description="Xem thông tin cá nhân và quản lý bảo mật tài khoản của bạn."
      />
      {error ? (
        <div className="form-alert page-alert" role="alert">
          <Icon name="alert" size={18} />
          {error}
          <button onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      ) : null}
      {success ? (
        <div className="success-alert" role="status">
          <Icon name="check" size={17} />
          {success}
        </div>
      ) : null}
      {loading ? (
        <div className="detail-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : profile ? (
        <div className="profile-grid">
          <aside className="profile-summary">
            <div className="profile-summary__avatar" aria-hidden="true">{initials}</div>
            <div className="profile-summary__body">
              <span className="profile-summary__eyebrow">TÀI KHOẢN CỦA BẠN</span>
              <h2>{profile.full_name}</h2>
              <span className="profile-role"><Icon name="shield" size={14} />{role ? roleLabel(role) : 'Nhân viên'}</span>
              <div className="profile-summary__contact"><Icon name="user" size={17} /><span>Mã tài khoản <strong>#{profile.user_id}</strong></span></div>
              <div className="profile-summary__contact"><Icon name="login" size={17} /><span>{profile.phone}</span></div>
            </div>
          </aside>
          <Panel
            className="profile-information"
            title="Chi tiết cá nhân"
            action={
              editing ? <span className="profile-edit-badge"><span />Đang chỉnh sửa</span> : (
                <Button
                  permission={['PUT', '/profile']}
                  size="small"
                  variant="primary"
                  onClick={() => {
                    setEditing(true);
                    setSuccess("");
                  }}
                >
                  Chỉnh sửa
                </Button>
              )
            }
          >
            <p className="profile-section-description">{editing ? 'Cập nhật họ tên và giới tính để thông tin của bạn luôn chính xác.' : 'Thông tin nhận diện và liên hệ của tài khoản.'}</p>
            {editing && can('PUT', '/profile') ? (
              <form
                className="profile-form"
                onSubmit={(event) => void save(event)}
              >
                <label className="profile-input-field">
                  <span className="profile-input-label">Họ và tên <span>*</span></span>
                  <span className="profile-input-control">
                    <Icon name="user" size={18} />
                    <input
                      autoComplete="name"
                      placeholder="Nhập họ và tên"
                      maxLength={150}
                      disabled={saving}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </span>
                </label>
                <label className="profile-input-field">
                  <span className="profile-input-label">Giới tính</span>
                  <span className="profile-input-control profile-input-control--select">
                  <Icon name="users" size={18} />
                  <select
                    disabled={saving}
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                  >
                    <option value="" disabled>
                      Chưa cập nhật
                    </option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                  <Icon name="chevron" size={16} className="profile-select-arrow" />
                  </span>
                </label>
                <label className="profile-input-field">
                  <span className="profile-input-label">Số điện thoại <span className="profile-input-locked"><Icon name="lock" size={12} />Chỉ xem</span></span>
                  <span className="profile-input-control profile-input-control--readonly"><Icon name="login" size={18} /><input value={profile.phone} readOnly /></span>
                </label>
                <label className="profile-input-field">
                  <span className="profile-input-label">Vai trò <span className="profile-input-locked"><Icon name="lock" size={12} />Chỉ xem</span></span>
                  <span className="profile-input-control profile-input-control--readonly"><Icon name="shield" size={18} /><input value={role ? roleLabel(role) : 'Nhân viên'} readOnly /></span>
                </label>
                <div className="profile-form__actions">
                  <p><Icon name="shield" size={15} />Thông tin được lưu vào tài khoản của bạn.</p>
                  <div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => {
                      setName(profile.full_name);
                      setGender(profile.gender ?? "");
                      setEditing(false);
                    }}
                  >
                    Hủy
                  </Button>
                  <Button permission={['PUT', '/profile']} type="submit" icon={<Icon name="check" size={16} />} disabled={saving || !name.trim()}>
                    {saving ? "Đang lưu…" : "Lưu thay đổi"}
                  </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="detail-fields profile-fields">
                <div>
                  <span className="detail-label">Họ và tên</span>
                  <strong>{profile.full_name}</strong>
                </div>
                <div>
                  <span className="detail-label">Số điện thoại</span>
                  <strong>{profile.phone}</strong>
                </div>
                <div>
                  <span className="detail-label">Giới tính</span>
                  <strong>
                    {(
                      { male: "Nam", female: "Nữ", other: "Khác" } as Record<
                        string,
                        string
                      >
                    )[profile.gender ?? ""] ?? "Chưa cập nhật"}
                  </strong>
                </div>
                <div>
                  <span className="detail-label">Email khôi phục</span>
                  <strong>{profile.recovery_email || "Chưa thiết lập"}</strong>
                </div>
                <div>
                  <span className="detail-label">Vai trò</span>
                  <strong>{role ? roleLabel(role) : "Nhân viên"}</strong>
                </div>
                {profile.year_of_birth ? (
                  <div>
                    <span className="detail-label">Năm sinh</span>
                    <strong>{profile.year_of_birth}</strong>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
          <Panel className="profile-security">
            <div className="profile-security__icon">
              <Icon name="lock" size={20} />
            </div>
            <div>
              <h2>Bảo mật tài khoản</h2>
              <p>Bảo vệ tài khoản bằng mật khẩu và email khôi phục.</p>
              <div className={`profile-email-status${profile.recovery_email ? ' profile-email-status--ready' : ''}`}><Icon name="mail" size={15} /><span>{profile.recovery_email ? 'Đã thiết lập email khôi phục' : 'Chưa thiết lập email khôi phục'}</span></div>
            </div>
            {can('PUT', '/auth/change-password') ? <Link
              className="button button--secondary"
              to="/app/profile/password"
            >
              Đổi mật khẩu
            </Link> : null}
          </Panel>
        </div>
      ) : null}
    </>
  );
}
