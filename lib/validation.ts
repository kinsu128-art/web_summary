import { z } from "zod";

const normalizedUrlSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => {
    try {
      return new URL(value).toString();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid URL"
      });
      return z.NEVER;
    }
  });

export const importDocumentSchema = z.object({
  url: normalizedUrlSchema,
  title: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  folder_ids: z.array(z.string().uuid()).optional(),
  save_raw_html: z.boolean().optional().default(false)
});

export const updateDocumentSchema = z
  .object({
    user_title: z.string().trim().min(1).nullable().optional(),
    content_markdown: z.string().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    folder_ids: z.array(z.string().uuid()).optional()
  })
  .strict();

export const createTagSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().optional()
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional()
});

export const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional()
  })
  .strict();

export const authSignUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});
