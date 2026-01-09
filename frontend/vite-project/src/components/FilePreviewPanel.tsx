import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "./ui/skeleton";
import { FileText, BarChart3, Hash, Type, Calendar, AlertCircle } from "lucide-react";
import { getFileStats } from "../features/home/api/uploads";

interface FilePreviewPanelProps {
  userId: string;
  fileId: string;
}

export function FilePreviewPanel({ userId, fileId }: FilePreviewPanelProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["fileStats", userId, fileId],
    queryFn: () => getFileStats({ userId, fileId }),
    enabled: Boolean(userId && fileId),
    staleTime: 60000, // Cache for 1 minute
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load file statistics
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statItems = [
    {
      icon: FileText,
      label: "Total Rows",
      value: stats.total_rows.toLocaleString(),
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: BarChart3,
      label: "Total Columns",
      value: stats.total_columns.toLocaleString(),
      color: "text-green-600 dark:text-green-400",
    },
    {
      icon: Hash,
      label: "Numeric Columns",
      value: stats.numeric_columns.toLocaleString(),
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: Type,
      label: "Categorical Columns",
      value: stats.categorical_columns.toLocaleString(),
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      icon: FileText,
      label: "Text Columns",
      value: stats.text_columns.toLocaleString(),
      color: "text-pink-600 dark:text-pink-400",
    },
    {
      icon: Calendar,
      label: "Date/Time Columns",
      value: stats.datetime_columns.toLocaleString(),
      color: "text-cyan-600 dark:text-cyan-400",
    },
    {
      icon: AlertCircle,
      label: "Other Columns",
      value: stats.other_columns.toLocaleString(),
      color: "text-gray-600 dark:text-gray-400",
    },
    {
      icon: AlertCircle,
      label: "Missing Values",
      value: `${stats.missing_value_percentage}%`,
      color: stats.missing_value_percentage > 10 
        ? "text-red-600 dark:text-red-400" 
        : "text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="space-y-1">
      {statItems.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
          <span className={`text-xs font-semibold ${item.color}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
