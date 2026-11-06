import { z } from 'zod';

export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^(03|05|07|08|09)\d{8}$/,
      'Số điện thoại phải có 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.',
    ),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
