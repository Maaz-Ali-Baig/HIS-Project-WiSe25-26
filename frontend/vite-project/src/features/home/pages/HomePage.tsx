import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { uploadFile } from '../api/uploads';
import { toast } from 'sonner';

export function HomePage() {
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user, logout } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      toast.success('File uploaded successfully!');
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      // Navigate to the file ID route
      navigate(`/${data.fileId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file');
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate CSV extension
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please select a CSV file');
        event.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !user?.id) {
      toast.error('Please select a file to upload');
      return;
    }

    uploadMutation.mutate({
      userId: user.id,
      username: user.username,
      file: selectedFile,
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Welcome Card */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>You are successfully logged in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {fileId && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm font-medium text-blue-700">Last uploaded file:</p>
                <p className="text-sm text-blue-600 mt-1 font-mono">{fileId}</p>
                <a
                  href={`http://localhost:8000/file/${user.id}/${fileId}.csv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
                >
                  Download file
                </a>
              </div>
            )}

            <Button onClick={handleLogout} variant="destructive" className="w-full">
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* Upload CSV Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file to process and analyze your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
              {selectedFile && (
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-medium">{selectedFile.name}</span>
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Only CSV files are accepted. Maximum file size: 10MB
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
