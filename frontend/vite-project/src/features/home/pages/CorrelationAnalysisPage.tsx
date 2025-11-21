import { TopNav } from '../../../components/TopNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';

export function CorrelationAnalysisPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav active="correlation" />

      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-6xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Correlation Analysis</CardTitle>
              <CardDescription>
                Association between qualitative variables (χ², Cramér&apos;s V, rank correlations, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                This is a placeholder page. Later you can trigger R scripts for correlation
                and display tables and plots of the results here.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
