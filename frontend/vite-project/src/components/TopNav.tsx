// frontend/vite-project/src/components/TopNav.tsx
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuthStore } from '../store/auth';
import { useFileStore } from '../store/fileStore';

export type NavKey =
  | 'home'
  | 'transform'
  | 'correlation'
  | 'visualization'
  | 'report';

interface TopNavProps {
  active: NavKey;
}

export function TopNav({ active }: TopNavProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { fileId } = useFileStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const buildPath = (suffix: string) => {
    if (!fileId) {
      return "/";
    }
    return `/${fileId}/${suffix}`;
  };

  const pillClass = (key: NavKey) =>
    key === active
      ? 'rounded-full bg-white px-6 py-2 text-sm font-semibold text-blue-700 shadow-lg'
      : 'text-sm font-medium text-blue-100 hover:text-white';

  return (
    <header className="w-full bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        {/* Logo + title */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-28 items-center justify-center rounded-2xl bg-white shadow-lg">
            <img
              src="/logo.png"
              alt="Logo"
              className="max-h-12 max-w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none">
              Data Pre-Processing Platform
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              for Qualitative Data Analysis
            </p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="ml-8 flex flex-1 items-center justify-end gap-8">
          <button
            type="button"
            className={pillClass('home')}
            onClick={() => navigate(fileId ? `/${fileId}/load-data` : '/')}
          >
            Selection and Preview
          </button>
          <button
            type="button"
            className={pillClass('transform')}
            onClick={() => navigate(buildPath('pre-processing'))}
          >
            Data Transformation
          </button>
          <button
            type="button"
            className={pillClass('correlation')}
            onClick={() => navigate(buildPath('correlation'))}
          >
            Correlation Analysis
          </button>
          <button
            type="button"
            className={pillClass('visualization')}
            onClick={() => navigate(buildPath('visualization'))}
          >
            Visualization
          </button>
          <button
            type="button"
            className={pillClass('report')}
            onClick={() => navigate(buildPath('report'))}
          >
            Report
          </button>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="rounded-full border-white/80 bg-transparent px-6 py-2 text-sm font-semibold text-white hover:bg-white hover:text-blue-700"
          >
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
