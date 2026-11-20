import {
  AppstoreOutlined,
  FileTextOutlined,
  SolutionOutlined,
  TeamOutlined,
  BankOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  SettingOutlined,
  LogoutOutlined,
  SearchOutlined,
  BellOutlined,
  MenuOutlined,
  RightOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  PlusOutlined,
  CalendarOutlined,
  ProfileOutlined,
  BarChartOutlined,
  PlusCircleOutlined,
  CloseOutlined,
  UserOutlined,
  LockOutlined,
  MailOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LoginOutlined,
  ApartmentOutlined,
  LayoutOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

export type IconName =
  | "dashboard"
  | "records"
  | "patient"
  | "users"
  | "facility"
  | "template"
  | "shield"
  | "activity"
  | "prescription"
  | "lab"
  | "settings"
  | "logout"
  | "search"
  | "bell"
  | "menu"
  | "chevron"
  | "arrow"
  | "check"
  | "clock"
  | "alert"
  | "plus"
  | "calendar"
  | "clipboard"
  | "chart"
  | "mark"
  | "close"
  | "user"
  | "lock"
  | "mail"
  | "refresh"
  | "eye"
  | "eyeOff"
  | "login"
  | "hospital"
  | "department"
  | "room"
  | "phone"
  | "pin"
  | "edit"
  | "trash";

const icons = {
  dashboard: AppstoreOutlined,
  records: FileTextOutlined,
  patient: SolutionOutlined,
  users: TeamOutlined,
  facility: BankOutlined,
  template: ReadOutlined,
  shield: SafetyCertificateOutlined,
  activity: HeartOutlined,
  prescription: MedicineBoxOutlined,
  lab: ExperimentOutlined,
  settings: SettingOutlined,
  logout: LogoutOutlined,
  search: SearchOutlined,
  bell: BellOutlined,
  menu: MenuOutlined,
  chevron: RightOutlined,
  arrow: ArrowRightOutlined,
  check: CheckOutlined,
  clock: ClockCircleOutlined,
  alert: WarningOutlined,
  plus: PlusOutlined,
  calendar: CalendarOutlined,
  clipboard: ProfileOutlined,
  chart: BarChartOutlined,
  mark: PlusCircleOutlined,
  close: CloseOutlined,
  user: UserOutlined,
  lock: LockOutlined,
  mail: MailOutlined,
  refresh: ReloadOutlined,
  eye: EyeOutlined,
  eyeOff: EyeInvisibleOutlined,
  login: LoginOutlined,
  hospital: MedicineBoxOutlined,
  department: ApartmentOutlined,
  room: LayoutOutlined,
  phone: PhoneOutlined,
  pin: EnvironmentOutlined,
  edit: EditOutlined,
  trash: DeleteOutlined,
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return (
    <Component
      className={className}
      aria-hidden="true"
      style={{
        fontSize: size,
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    />
  );
}
