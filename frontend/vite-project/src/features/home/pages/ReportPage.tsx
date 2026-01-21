import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { FileLayout } from '../../../components/layout/FileLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { FileText, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function ReportPage() {
  // 1. Get Params from Router and Store
  const navigate = useNavigate();
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();

  // 2. Local State
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDownload = async () => {
    if (!user || !fileId) {
      setError("Missing user or file information.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("Requesting report...", { userId: user.id, fileId });

      // 3. API Call - Use absolute URL to backend server
      const baseURL = 'http://localhost:8000';
      const response = await fetch(
        `${baseURL}/api/files/report/download?userId=${user.id}&fileId=${fileId}`,
        { method: 'GET' }
      );

      // 4. Error Handling
      if (!response.ok) {
        const errorText = await response.text();
        // Check if we accidentally got the React HTML instead of JSON/PDF
        if (errorText.trim().startsWith("<!doctype html>")) {
          throw new Error("Proxy Error: Backend unreachable. Received HTML instead of File.");
        }
        throw new Error(`Server Error: ${response.status} - ${errorText}`);
      }

      // 5. Blob Processing
      const blob = await response.blob();

      // 6. Force Browser Download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Naming the file
      link.download = `Data Pre-Processing Platform_Report_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();

      // 7. Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(true);

    } catch (err: any) {
      console.error("Download failed:", err);
      setError(err.message || "Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 8. Redirect if no fileId
  if (!fileId) {
    navigate("/");
    return null;
  }

  // 9. Render Loading/Missing State if needed
  if (!user) {
    return null;
  }

  return (
    <FileLayout actions={[]}>
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <Card className="shadow-lg border-t-4 border-t-[#3b5f9e]">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-[#3b5f9e]" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-800">
                Analysis Report
              </CardTitle>
              <CardDescription className="text-gray-600 text-base mt-2">
                Download a complete HTML summary of your data processing, visualization, and correlation analysis.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8 pt-6">

              <div className="flex flex-col items-center justify-center space-y-4">
                <Button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="bg-[linear-gradient(180deg,#3b5f9e_0%,#345ca8_100%)] hover:opacity-90 text-white px-8 py-6 h-auto text-lg rounded-xl shadow-md transition-all min-w-[280px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-5 w-5" />
                      Download HTML Report
                    </>
                  )}
                </Button>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Generation Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Success Alert */}
              {success && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    Report downloaded! Check your downloads folder.
                  </AlertDescription>
                </Alert>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </FileLayout>
  );
}