'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/client';
import { Field } from './ui';

export default function Login({ role }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const router = useRouter();
  const isAdmin = role === 'admin';
  const demoAccounts = isAdmin
    ? [{ name: 'Giáo viên Demo', identifier: 'admin@quizify.test', email: 'admin@quizify.test' }]
    : [
      { name: 'Học sinh Demo 01', identifier: 'HS001', email: 'hs01@quizify.test' },
      { name: 'Học sinh Demo 02', identifier: 'HS002', email: 'hs02@quizify.test' },
      { name: 'Học sinh Demo 03', identifier: 'HS003', email: 'hs03@quizify.test' }
    ];
  function fillDemo(identifier) {
    if (busy || !formRef.current) return;
    formRef.current.elements.namedItem('identifier').value = identifier;
    formRef.current.elements.namedItem('password').value = 'Demo12345!';
    setError('');
    formRef.current.querySelector('button[type="submit"]').focus();
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try { await api(`/auth/${isAdmin ? 'admin' : 'user'}/login`, { method: 'POST', body: { identifier: form.get('identifier'), password: form.get('password') } }); router.replace(`/${isAdmin ? 'admin' : 'user'}/dashboard`); router.refresh(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-logo"><img src="/logo.svg" alt="Quizify" width={48} height={48} /></div><h1 className="auth-title">Quizify</h1><h2 className="auth-subtitle">{isAdmin ? 'Đăng nhập Admin' : 'Đăng nhập học sinh'}</h2>
    <form ref={formRef} className="stack" method="post" action={`/api/auth/${isAdmin ? 'admin' : 'user'}/login`} onSubmit={submit}>
      <Field label={isAdmin ? 'Email' : 'Email hoặc mã học sinh'}><input className="input" name="identifier" required maxLength={200} autoComplete="username" spellCheck={false} autoCapitalize="none" /></Field>
      <Field label="Mật khẩu"><input className="input" name="password" type="password" required maxLength={128} autoComplete="current-password" /></Field>
      {error && <p role="alert" className="error-text">{error}</p>}
      <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
    <section className="auth-demo" aria-labelledby="demo-title">
      <h3 id="demo-title">Tài khoản demo</h3>
      <p className="small muted">Chọn tài khoản để điền sẵn, sau đó bấm Đăng nhập.</p>
      <ul className="auth-demo-list">{demoAccounts.map(account => <li key={account.identifier}>
        <div className="auth-demo-account"><strong>{account.name}</strong><span>{account.email}</span>{!isAdmin && <span>Mã học sinh: <code>{account.identifier}</code></span>}</div>
        <button type="button" className="btn secondary" disabled={busy} aria-label={`Điền tài khoản ${account.name}`} onClick={() => fillDemo(account.identifier)}>Điền</button>
      </li>)}</ul>
      <p className="auth-demo-password small">Mật khẩu mặc định: <code>Demo12345!</code></p>
      <p className="small muted">Chỉ dùng thử trên máy local. Nếu đã đổi mật khẩu hoặc cấu hình seed, hãy dùng mật khẩu đã thiết lập.</p>
    </section>
    <p className="small muted">Tài khoản được cấp bởi giáo viên. Không có đăng ký tự do.</p><Link className="link-button" href={isAdmin ? '/user-login' : '/admin-login'}>{isAdmin ? 'Đăng nhập học sinh' : 'Đăng nhập dành cho giáo viên'}</Link>
  </section></main>;
}
