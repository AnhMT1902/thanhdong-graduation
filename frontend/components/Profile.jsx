'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/client';
import { useSession } from './Shell';
import { Heading, Field } from './ui';

export default function Profile() {
  const { user, setUser, notify } = useSession();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const isAdmin = user.role === 'admin';
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = { fullName: form.get('fullName').trim() };
    if (form.get('newPassword')) { value.newPassword = form.get('newPassword'); value.currentPassword = form.get('currentPassword'); }
    try { const result = await api('/user/profile', { method: 'PATCH', body: value }); if (result.requiresLogin) { router.replace('/user-login'); router.refresh(); } else { setUser({ ...user, fullName: value.fullName }); notify('Đã cập nhật hồ sơ'); } }
    catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }
  return <div className="stack"><Heading title="Hồ sơ cá nhân" subtitle="Thông tin tài khoản đang đăng nhập" /><section className="panel"><div className="panel-body"><form className="stack" onSubmit={submit}><div className="form-row"><Field label="Họ và tên"><input className="input" name="fullName" defaultValue={user.fullName} disabled={isAdmin} required maxLength={200} /></Field><Field label="Email"><input className="input" value={user.email} disabled readOnly /></Field></div>{!isAdmin && <div className="form-row"><Field label="Mã học sinh"><input className="input" value={user.studentCode || ''} disabled readOnly /></Field><Field label="Lớp"><input className="input" value={user.className || 'Chưa có lớp'} disabled readOnly /></Field></div>}{!isAdmin && <><h2 className="section-title">Đổi mật khẩu nếu cần</h2><div className="form-row"><Field label="Mật khẩu hiện tại"><input className="input" name="currentPassword" type="password" autoComplete="current-password" /></Field><Field label="Mật khẩu mới"><input className="input" name="newPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" /></Field></div><p className="small muted">Mật khẩu mới tối thiểu 8 ký tự. Đổi mật khẩu sẽ yêu cầu đăng nhập lại.</p><div><button className="btn primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div></>}{isAdmin && <p className="muted">Hồ sơ Admin ở chế độ chỉ xem.</p>}</form></div></section></div>;
}
