import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { ChangePasswordForm } from './ChangePasswordForm';

export function PasswordPage() {
  const navigate = useNavigate();
  return (
    <div className="password-page password-page--compact">
      <div className="detail-back"><Link to="/app/profile"><Icon name="arrow" size={16} className="back-arrow" />Thông tin cá nhân</Link></div>
      <PageHeader title="Đổi mật khẩu" description="Sau khi đổi mật khẩu, bạn sẽ đăng nhập lại để tiếp tục sử dụng." />
      <Panel><ChangePasswordForm onCancel={() => navigate('/app/profile')} /></Panel>
    </div>
  );
}
