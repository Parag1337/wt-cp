import { z } from "zod";

const emailSchema = z
  .email("Please enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(255);

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+91[\s-]?)?[6-9]\d{9}$/,
    "Please enter a valid phone number."
  );

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(120, "Name is too long."),
  email: emailSchema,
  phone: phoneSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Please enter your password.").max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Please enter your current password.").max(128),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;