import { TopNav } from '../../../components/TopNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';

export function ReportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav active="report" />

      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-6xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report</CardTitle>
              <CardDescription>
                Summary of preprocessing, transformations, correlations and visualizations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                This is a placeholder page. Later you can aggregate results from R and
                offer exportable reports (PDF/HTML/Markdown) here.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
