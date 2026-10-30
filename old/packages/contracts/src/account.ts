import { z } from 'zod'
import { Id, IsoDateTime } from './common.js'

export const Username = z
  .string()
  .trim()
  .min(2, '用户名至少 2 个字符')
  .max(32, '用户名最多 32 个字符')
  .regex(/^[\p{L}\p{N}_-]+$/u, '用户名只能包含文字、数字、下划线或短横线')

export const Password = z
  .string()
  .min(8, '密码至少 8 位')
  .max(128, '密码过长')
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    '密码需同时包含字母和数字',
  )

export const Email = z.string().trim().email('请输入有效的邮箱地址').max(254, '邮箱地址过长')

export const PublicUserSchema = z.object({
  id: Id,
  username: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type PublicUser = z.infer<typeof PublicUserSchema>

export const RegisterInput = z.object({
  username: Username,
  email: Email,
  password: Password,
  captchaId: z.string().optional(),
  captchaAnswer: z.string().optional(),
})
export type RegisterInput = z.infer<typeof RegisterInput>

export const LoginInput = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
  captchaId: z.string().optional(),
  captchaAnswer: z.string().optional(),
})
export type LoginInput = z.infer<typeof LoginInput>

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: Password,
})
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>

export const AuthStatus = z.object({
  hasUsers: z.boolean(),
  captchaEnabled: z.boolean(),
})
export type AuthStatus = z.infer<typeof AuthStatus>

export const AuthResult = z.object({
  user: PublicUserSchema,
})
export type AuthResult = z.infer<typeof AuthResult>
