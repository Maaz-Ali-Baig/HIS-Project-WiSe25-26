import { TopNav } from "../../../components/TopNav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import Encoding from "./Encoding";

export function DataTransformationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav active="transform" />

      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-6xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Transformation</CardTitle>
              <CardDescription>
                R-based transformations (encoding, binning, recoding, etc.) will
                be implemented here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                This is a placeholder page. Later you can hook this up to your R
                preprocessing endpoints and show transformation options and
                results here.
              </p>
              <Encoding />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
