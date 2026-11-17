import type { Field } from './shared';

export const gender: Field = {
  name: 'gender',
  label: 'Giới tính',
  type: 'select',
  choices: [
    { value: 'male', label: 'Nam' },
    { value: 'female', label: 'Nữ' },
    { value: 'other', label: 'Khác' },
  ],
};
export const accountFields: Field[] = [
  { name: 'full_name', label: 'Họ và tên', required: true, maxLength: 150 },
  {
    name: 'phone',
    label: 'Số điện thoại',
    type: 'tel',
    required: true,
    createOnly: true,
    pattern: '(03|05|07|08|09)[0-9]{8}',
    maxLength: 10,
    hint: '10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.',
  },
  {
    name: 'password',
    label: 'Mật khẩu ban đầu',
    type: 'password',
    required: true,
    createOnly: true,
    minLength: 6,
    maxLength: 72,
  },
  gender,
];
export const patientFields: Field[] = [
  ...accountFields,
  {
    name: 'year_of_birth',
    label: 'Năm sinh',
    type: 'number',
    min: 1900,
    max: 2100,
    nullable: true,
  },
  { name: 'career', label: 'Nghề nghiệp', maxLength: 150, nullable: true },
  { name: 'ethnic', label: 'Dân tộc', maxLength: 50, nullable: true },
  {
    name: 'hamlet_address',
    label: 'Số nhà / thôn / xóm',
    maxLength: 150,
    nullable: true,
  },
  {
    name: 'commune_address',
    label: 'Xã / phường',
    maxLength: 150,
    nullable: true,
  },
  {
    name: 'city_address',
    label: 'Tỉnh / thành phố',
    maxLength: 150,
    nullable: true,
  },
  { name: 'work_place', label: 'Nơi làm việc', maxLength: 255, nullable: true },
  {
    name: 'health_insurance_number',
    label: 'Mã bảo hiểm y tế',
    maxLength: 30,
    nullable: true,
  },
  {
    name: 'health_insurance_validate',
    label: 'BHYT có giá trị đến',
    type: 'date',
    nullable: true,
  },
  {
    name: 'next_of_kin_name',
    label: 'Người thân liên hệ',
    maxLength: 150,
    nullable: true,
  },
  {
    name: 'next_of_kin_phone',
    label: 'Điện thoại người thân',
    type: 'tel',
    maxLength: 20,
    nullable: true,
  },
];
