import { z } from 'zod';
import { HttpError } from './security.js';

export const uuid = z.uuid();
const name = z.string().trim().min(1).max(200);
const status = z.enum(['active', 'inactive']);
export const password = z.string().min(8).max(128);
export const loginSchema = z.object({ identifier: z.string().trim().min(1).max(200), password: z.string().min(1).max(128) }).strict();
export const studentSchema = z.object({ fullName: name, email: z.email().max(200).transform(value => value.toLowerCase()), studentCode: z.string().trim().min(1).max(40), password, classId: uuid.nullable().optional(), status: status.default('active') }).strict();
export const studentUpdate = studentSchema.omit({ password: true }).partial().extend({ status: status.optional(), password: password.optional() });
export const classSchema = z.object({ code: z.string().trim().min(1).max(40), name, grade: z.string().max(40).default(''), status: status.default('active'), subjectIds: z.array(uuid).max(50).default([]) }).strict();
export const subjectSchema = z.object({ code: z.string().trim().min(1).max(40), name, gradeScope: z.string().max(40).default(''), status: status.default('active') }).strict();
export const questionSchema = z.object({ subjectId: uuid, content: z.string().trim().min(1).max(5000), type: z.literal('single').default('single'), difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'), explanation: z.string().max(5000).default(''), options: z.array(z.object({ content: z.string().trim().min(1).max(2000), isCorrect: z.boolean() }).strict()).min(2).max(8) }).strict().refine(value => value.options.filter(option => option.isCorrect).length === 1, { message: 'Câu hỏi cần đúng một đáp án đúng' });
export const quizSchema = z.object({ title: name, subjectId: uuid, description: z.string().max(5000).default(''), durationMinutes: z.number().int().min(1).max(180), questions: z.array(z.object({ questionId: uuid, points: z.number().positive().max(100) }).strict()).max(100).default([]) }).strict().refine(value => new Set(value.questions.map(question => question.questionId)).size === value.questions.length, { message: 'Không lặp câu hỏi trong đề' });
export const assignmentSchema = z.object({ quizId: uuid, targetType: z.enum(['class', 'student']), classIds: z.array(uuid).max(100).default([]), studentIds: z.array(uuid).max(500).default([]), openAt: z.iso.datetime({ offset: true }), dueAt: z.iso.datetime({ offset: true }), maxAttempts: z.number().int().min(1).max(10), showAnswersAfterSubmit: z.boolean().default(true) }).strict().refine(value => Date.parse(value.dueAt) > Date.parse(value.openAt), { message: 'Hạn nộp phải sau giờ mở' }).refine(value => value.targetType === 'class' ? value.classIds.length > 0 && value.studentIds.length === 0 : value.studentIds.length > 0 && value.classIds.length === 0, { message: 'Chọn một loại đối tượng và ít nhất một đối tượng' });
export const answerSchema = z.object({ questionId: uuid, selectedOptionIds: z.array(uuid).max(1), flagged: z.boolean().default(false) }).strict();
export const profileSchema = z.object({ fullName: name.optional(), currentPassword: password.optional(), newPassword: password.optional() }).strict().refine(value => !value.newPassword || !!value.currentPassword, { message: 'Cần mật khẩu hiện tại' });

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message || 'Dữ liệu không hợp lệ');
  return result.data;
}

export function validId(value) {
  return parse(uuid, value);
}

export function paginate(items, query) {
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize, 10) || 8));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(query.page, 10) || 1));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}
