import { useMultiCorrelationStore } from '@/store/multiCorrelationStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MissingValueHandler() {
  const {
    missingInfo,
    missingValueMethod,
    setMissingValueMethod,
    setCurrentStep,
  } = useMultiCorrelationStore();

  const hasMissing = missingInfo.some((info) => info.missingCount > 0);

  const handleContinue = () => {
    setCurrentStep('methods');
  };

  const handleBack = () => {
    setCurrentStep('configure');
  };

  if (!hasMissing) {
    // No missing values, skip this step
    return (
      <Card>
        <CardHeader className="pb-2 py-3">
          <CardTitle>No Missing Values Detected</CardTitle>
          <CardDescription className="text-xs">
            All selected columns have complete data. You can proceed to method selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-3">
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleContinue}>
              Continue to Methods
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 py-3">
        <CardTitle>Missing Values Detected</CardTitle>
        <CardDescription className="text-xs">
          Choose how to handle missing values before analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-3">
        {/* Missing value summary */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {missingInfo
                .filter((info) => info.missingCount > 0)
                .map((info) => (
                  <div key={info.columnName} className="flex justify-between text-sm">
                    <span className="font-medium">{info.columnName}:</span>
                    <span className="text-orange-600">
                      {info.missingCount} missing ({info.missingPercentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>

        {/* Method selection */}
        <div className="space-y-2">
          <Label>Missing Value Handling Method</Label>
          <RadioGroup value={missingValueMethod} onValueChange={(value) => setMissingValueMethod(value as any)}>
            <div className="space-y-3">
              <div className="flex items-start space-x-2 p-3 border rounded-md hover:bg-muted/50">
                <RadioGroupItem value="remove" id="remove" className="mt-1" />
                <div className="grid gap-1.5 leading-none flex-1">
                  <Label htmlFor="remove" className="font-semibold cursor-pointer">
                    Remove rows with missing values
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only use complete cases (recommended when missing % is small)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 border rounded-md hover:bg-muted/50">
                <RadioGroupItem value="mode" id="mode" className="mt-1" />
                <div className="grid gap-1.5 leading-none flex-1">
                  <Label htmlFor="mode" className="font-semibold cursor-pointer">
                    Impute with Mode (most common value)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Best for nominal/categorical variables
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 border rounded-md hover:bg-muted/50">
                <RadioGroupItem value="median" id="median" className="mt-1" />
                <div className="grid gap-1.5 leading-none flex-1">
                  <Label htmlFor="median" className="font-semibold cursor-pointer">
                    Impute with Median
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Best for ordinal variables (uses middle value based on ordering)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 border rounded-md hover:bg-muted/50">
                <RadioGroupItem value="missing_category" id="missing_category" className="mt-1" />
                <div className="grid gap-1.5 leading-none flex-1">
                  <Label htmlFor="missing_category" className="font-semibold cursor-pointer">
                    Create "Missing" category
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Keep missing as separate category in analysis
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Configuration
          </Button>
          <Button onClick={handleContinue}>
            Apply & Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
