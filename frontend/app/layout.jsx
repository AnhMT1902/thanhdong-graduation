import '../styles/tokens.css';
import '../styles/components.css';
import '../styles/pages.css';
import '../styles/glue.css';
import '../styles/workspace.css';
import '../styles/controls.css';

export const metadata = { title: 'Quizify — Kiểm tra lớp học', description: 'Website kiểm tra trắc nghiệm trực tuyến cho lớp học', icons: { icon: { url: '/logo.svg', type: 'image/svg+xml', sizes: 'any' } } };
export default function RootLayout({ children }) {
  return <html lang="vi"><body>{children}</body></html>;
}
