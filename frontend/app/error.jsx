'use client';
export default function ErrorPage({ reset }) { return <main className="auth-page"><div className="auth-card"><h1>Không tải được dữ liệu</h1><p>Kiểm tra kết nối và thử lại.</p><button className="btn primary" onClick={reset}>Thử lại</button></div></main>; }
