import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { authApi } from './auth-api';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (step === 'reset') {
      if (!/^\d{6}$/.test(otp)) {
        setError('Mã OTP cần có đúng 6 chữ số.');
        return;
      }
      if (password.length < 6 || password !== confirmPassword) {
        setError('Mật khẩu mới cần ít nhất 6 ký tự và hai ô mật khẩu phải trùng khớp.');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (step === 'email') {
        await authApi.forgotPassword(normalizedEmail);
        setStep('reset');
      } else {
        await authApi.resetPassword({
          email: normalizedEmail,
          otp,
          new_password: password,
          confirm_password: confirmPassword,
        });
        navigate('/login', {
          replace: true,
          state: { message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' },
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xử lý yêu cầu khôi phục mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="medical-login-wrapper">
      {/* Background medical atmosphere */}
      <div className="medical-bg-layer" aria-hidden="true">
        <div className="medical-bg-ambient" />
        <div className="medical-bg-grid" />
        <div className="medical-bg-nodes" />
      </div>

      {/* Top hospital branding banner */}
      <header className="hospital-top-banner">
        <div className="hospital-top-inner">
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
            <p className="hospital-tagline">HỆ THỐNG QUẢN LÝ VÀ THEO DÕI ĐIỀU TRỊ BỆNH MÀY ĐAY (MAYDAY)</p>
          </div>

          <div className="hospital-top-extra" aria-hidden="true">
            <span className="hospital-badge-pill">KHÔI PHỤC MẬT KHẨU</span>
          </div>
        </div>
      </header>

      {/* Center Card */}
      <section className="login-card-container">
        <div className="hospital-login-card">
          <div className="login-card-header">
            <h2 className="login-card-title">{step === 'email' ? 'QUÊN MẬT KHẨU' : 'XÁC MINH MÃ OTP'}</h2>
            <p className="login-card-subtitle">
              {step === 'email'
                ? 'Nhập email khôi phục đã đăng ký để nhận mã OTP'
                : `Mã OTP xác thực 6 số đã được gửi đến ${email.trim().toLowerCase()}`}
            </p>
          </div>

          {error ? (
            <div className="login-alert login-alert--error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="hospital-login-form" onSubmit={(event) => void submit(event)} noValidate>
            <div className="hospital-form-group">
              <TextField
                label="Email khôi phục:"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@hospital.vn"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={step === 'reset'}
                icon="mail"
                required
              />
            </div>

            {step === 'reset' ? (
              <>
                <div className="hospital-form-group">
                  <TextField
                    label="Mã OTP (6 chữ số):"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Nhập mã 6 chữ số từ email..."
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    icon="shield"
                    required
                  />
                </div>
                <div className="hospital-form-group">
                  <TextField
                    label="Mật khẩu mới:"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Tối thiểu 6 ký tự..."
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    icon="lock"
                    required
                  />
                </div>
                <div className="hospital-form-group">
                  <TextField
                    label="Nhập lại mật khẩu mới:"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Nhập lại chính xác mật khẩu..."
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    icon="lock"
                    required
                  />
                </div>
                <div className="form-secondary-actions">
                  <button
                    className="resend-link"
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setOtp('');
                      setError('');
                    }}
                  >
                    Gửi lại mã OTP tới email khác
                  </button>
                </div>
              </>
            ) : null}

            <Button type="submit" className="hospital-login-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  <span>Đang xử lý…</span>
                </>
              ) : (
                <>
                  <Icon name={step === 'email' ? 'mail' : 'check'} size={18} />
                  <span>{step === 'email' ? 'GỬI MÃ XÁC MINH' : 'XÁC NHẬN ĐỔI MẬT KHẨU'}</span>
                </>
              )}
            </Button>
          </form>

          <div className="login-card-footer">
            <Link className="login-back-button" to="/login">
              <Icon name="arrow" size={16} className="back-flip-icon" />
              <span>Quay lại trang Đăng nhập</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="hospital-login-footer">
        <p>© {new Date().getFullYear()} BỆNH VIỆN DA LIỄU TRUNG ƯƠNG · Cổng thông tin y tế MayDay</p>
      </footer>
    </main>
  );
}
