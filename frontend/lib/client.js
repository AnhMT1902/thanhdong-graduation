'use client';
import { useCallback, useEffect, useState } from 'react';

export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Quizify', ...options.headers }, ...(options.body ? { body: JSON.stringify(options.body) } : {}), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Không xử lý được yêu cầu'); error.status = response.status; error.fields = data.fields || {}; throw error; }
  return data;
}

export function useLoad(path, allPages = false) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    async function load() {
      if (!allPages) return api(path, { signal: controller.signal });
      const [endpoint, search = ''] = path.split('?');
      const params = new URLSearchParams(search);
      params.set('pageSize', '50');
      const items = [];
      let page = 1;
      let result;
      do {
        params.set('page', String(page));
        result = await api(`${endpoint}?${params}`, { signal: controller.signal });
        items.push(...result.items);
        page += 1;
      } while (page <= result.totalPages);
      return { ...result, items };
    }
    load().then(value => { if (!controller.signal.aborted) setData(value); }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, version, allPages]);
  return { data, error, loading, reload, setData };
}
export function useCatalog(path) { return useLoad(path, true); }
export const date = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : '—';
export const score = value => value === null || value === undefined ? '—' : Number(value).toFixed(2);
export const time = seconds => `${Math.floor((seconds || 0) / 60)} phút ${(seconds || 0) % 60} giây`;
export const localDate = value => { const current = new Date(value); return new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export const stateLabels = { in_progress: 'Đang làm', submitted: 'Đã nộp', locked: 'Đang khóa', closed: 'Đã đóng', upcoming: 'Chưa mở', overdue: 'Quá hạn', not_started: 'Chưa làm', active: 'Hoạt động', inactive: 'Vô hiệu hóa', draft: 'Nháp', published: 'Đã xuất bản', archived: 'Lưu trữ', cancelled: 'Đã hủy' };
export function initials(fullName = '') {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const names = words.filter(word => /\p{L}/u.test(word));
  const parts = names.length > 1 ? [names[0], names.at(-1)] : words.length > 1 ? [words[0], words.at(-1)] : words;
  return parts.map(word => Array.from(word)[0]).join('').toLocaleUpperCase('vi-VN') || '?';
}
