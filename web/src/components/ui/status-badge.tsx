type Status = 'pending' | 'in_progress' | 'completed' | 'unavailable';

const labels: Record<Status, string> = {
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Hoàn tất',
  unavailable: 'Chưa kết nối',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status--${status}`}><span className="status__dot" />{labels[status]}</span>;
}
