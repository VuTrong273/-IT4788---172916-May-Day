import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from './auth-context';
import { roleFromId } from './auth-types';

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as {
    from?: string;
    message?: string;
  } | null;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in with valid staff/admin role, redirect to portal
  if (session && roleFromId(session.user.role_id)) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('Vui lòng nhập số điện thoại / tài khoản đăng nhập.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setSubmitting(true);

    try {
      await signIn(cleanPhone, password);
      const from = locationState?.from ?? '/app';
      navigate(from, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin tài khoản.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="medical-login-wrapper">
      {/* Background medical tech atmosphere */}
      <div className="medical-bg-layer" aria-hidden="true">
        <div className="medical-bg-ambient" />
        <div className="medical-bg-grid" />
        <div className="medical-bg-nodes" />
      </div>

      {/* Top hospital branding banner (as in sample layout) */}
      <header className="hospital-top-banner">
        <div className="hospital-top-inner">
          {/* Left: Project identity / Software crest */}
          <div className="brand-crest">
            <span className="brand-crest__badge">
              <span className="brand-crest__cross">+</span>
              <span className="brand-crest__pulse" />
            </span>
            <div className="brand-crest__text">
              <strong>MAYDAY</strong>
              <small>Clinical AI Care</small>
            </div>
          </div>

          {/* Center-Top: Hospital official accreditation mark */}
          <div className="hospital-title-block">
            <div className="hospital-title-sub">
              <span className="red-cross-mark" aria-hidden="true">
                <span className="red-cross-mark__bar red-cross-mark__bar--v" />
                <span className="red-cross-mark__bar red-cross-mark__bar--h" />
              </span>
              <span>BỆNH VIỆN DA LIỄU TRUNG ƯƠNG</span>
              <span className="hospital-title-sub__en">NATIONAL HOSPITAL OF DERMATOLOGY AND VENEREOLOGY</span>
            </div>
            <h1 className="hospital-title-main">BỆNH VIỆN DA LIỄU TRUNG ƯƠNG</h1>
            <p className="hospital-tagline">
              HỆ THỐNG QUẢN LÝ VÀ THEO DÕI ĐIỀU TRỊ BỆNH MÀY ĐAY (MAYDAY)
            </p>
          </div>

          {/* Right spacer for symmetrical centering */}
          <div className="hospital-top-extra" aria-hidden="true">
            <span className="hospital-badge-pill">CỔNG BÁC SĨ & QUẢN TRỊ</span>
          </div>
        </div>
      </header>

      {/* Center login card */}
      <section className="login-card-container">
        <div className="hospital-login-card">
          {/* Card Header */}
          <div className="login-card-header">
            <h2 className="login-card-title">ĐĂNG NHẬP</h2>
          </div>

          {/* Success notification if returning from password reset */}
          {locationState?.message ? (
            <div className="login-alert login-alert--success" role="status">
              <Icon name="check" size={17} />
              <span>{locationState.message}</span>
            </div>
          ) : null}

          {/* Error notification */}
          {error ? (
            <div className="login-alert login-alert--error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Login Form */}
          <form className="hospital-login-form" onSubmit={handleSubmit} noValidate>
            <div className="hospital-form-group">
              <TextField
                label="Tài khoản:"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="Nhập số điện thoại đăng nhập..."
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                icon="user"
                required
              />
            </div>

            <div className="hospital-form-group">
              <TextField
                label="Mật khẩu:"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                icon="lock"
                trailingAction={
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    tabIndex={-1}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                }
                required
              />
            </div>

            <div className="form-secondary-actions">
              <span className="account-scope-hint">
                <Icon name="shield" size={14} /> Dành cho Bác sĩ & Quản trị
              </span>
              <Link to="/forgot-password" className="forgot-password-link">
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              className="hospital-login-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  <span>Đang đăng nhập…</span>
                </>
              ) : (
                <>
                  <Icon name="login" size={19} className="login-btn-icon" />
                  <span>ĐĂNG NHẬP</span>
                </>
              )}
            </Button>
          </form>

          {/* Patient notice */}
          <div className="login-card-footer">
            <div className="patient-app-hint">
              <strong>Bệnh nhân ngoại trú?</strong>
              <p>
                Vui lòng sử dụng <em>Ứng dụng di động MayDay</em> để tự khai báo thông số cơ thể,
                chấm điểm UAS7/AAS7 và tải ảnh tiến triển tổn thương.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Hospital Footer */}
      <footer className="hospital-login-footer">
        <p>© {new Date().getFullYear()} BỆNH VIỆN DA LIỄU TRUNG ƯƠNG</p>
      </footer>
    </main>
  );
}
