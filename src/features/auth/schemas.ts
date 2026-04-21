import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

// Finance app — we won't nag users with 12 special characters, but we do need
// a meaningful floor. 8+ chars with at least one letter and one digit matches
// Supabase's default minimum and most contemporary guidance (NIST SP 800-63B).
const password = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Tell us your name').max(64, 'Too long'),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
