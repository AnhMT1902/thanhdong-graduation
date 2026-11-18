import AdminPage from '../../../../components/AdminPage';
export default async function Page({ params }) { const { segments = ['dashboard'] } = await params; return <AdminPage segments={segments} />; }
