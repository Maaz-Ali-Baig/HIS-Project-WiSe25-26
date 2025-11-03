import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';

export function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>You are successfully logged in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <div className="rounded-lg bg-gray-100 p-4">
              <p className="text-sm font-medium text-gray-500">Logged in as:</p>
              <p className="text-lg font-semibold">{user.username}</p>
              {user.id && (
                <p className="text-sm text-gray-500 mt-1">User ID: {user.id}</p>
              )}
              {user.created_at && (
                <p className="text-sm text-gray-500">
                  Account created: {new Date(user.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          <Button onClick={handleLogout} variant="destructive" className="w-full">
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
