import { Redirect } from 'expo-router';

// Giữ đường dẫn cũ để các phiên đang mở vẫn đến được trang chủ mới.
export default function DashboardRedirect() {
  return <Redirect href="/home" />;
}
