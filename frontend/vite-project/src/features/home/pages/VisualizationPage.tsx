import { TopNav } from '../../../components/TopNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';

export function VisualizationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav active="visualization" />

      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-6xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visualization</CardTitle>
              <CardDescription>
                Plots and visual summaries of qualitative data (bar charts, mosaics, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                This is a placeholder page. Later you can request charts from R and render them here.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
