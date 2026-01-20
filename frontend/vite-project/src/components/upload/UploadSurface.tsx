import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { uploadFile } from "../../features/home/api/uploads";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon, FileSpreadsheet } from "lucide-react";

interface UploadSurfaceProps {
  variant?: "hero" | "compact";
  requiresConfirmation?: boolean;
  onSuccess?: (fileId: string) => void;
  disabled?: boolean;
}

export function UploadSurface({
  variant = "hero",
  requiresConfirmation = false,
  onSuccess,
  disabled = false,
}: UploadSurfaceProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      toast.success("File uploaded successfully!");
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById(
        `csv-file-input-${variant}`,
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      if (onSuccess) {
        onSuccess(data.fileId);
      } else {
        // Navigate to the load-data route
        navigate(`/${data.fileId}/load-data`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload file");
    },
  });

  const validateAndSetFile = (file: File | null) => {
    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return false;
      }
      if (file.size > 10000 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return false;
      }
      setSelectedFile(file);
      return true;
    }
    return false;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!validateAndSetFile(file || null)) {
      event.target.value = "";
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    validateAndSetFile(file || null);
  };

  const handleFileInputClick = () => {
    document.getElementById(`csv-file-input-${variant}`)?.click();
  };

  const handleUpload = () => {
    if (!selectedFile || !user?.id) {
      toast.error("Please select a file to upload");
      return;
    }

    if (requiresConfirmation) {
      setShowConfirmDialog(true);
      return;
    }

    executeUpload();
  };

  const executeUpload = () => {
    if (!selectedFile || !user?.id) return;

    uploadMutation.mutate({
      userId: user.id,
      username: user.username,
      file: selectedFile,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const isLoading = uploadMutation.isPending || disabled;

  if (variant === "compact") {
    return (
      <>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileInputClick}
          className={`
            cursor-pointer rounded-lg border-2 border-dashed p-3 text-center transition-all
            ${
              isDragging
                ? "border-white bg-white/20"
                : "border-white/30 hover:border-white hover:bg-white/10"
            }
            ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <Input
            id={`csv-file-input-${variant}`}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isLoading}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-2">
            {selectedFile ? (
              <>
                <FileSpreadsheet className="h-5 w-5 text-white" />
                <div className="w-full">
                  <p className="text-xs font-medium text-white truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-white/60">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                  disabled={isLoading}
                  size="sm"
                  className="w-full bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="mr-2 h-3 w-3" />
                      Upload
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <UploadIcon className="h-5 w-5 text-white/70" />
                <p className="text-xs text-white/70">Upload new file</p>
                <p className="text-xs text-white/50">CSV • Max 10MB</p>
              </>
            )}
          </div>
        </div>

        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Upload new file?</AlertDialogTitle>
              <AlertDialogDescription>
                Uploading a new file will override current changes. This action
                cannot be undone. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeUpload}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Hero variant
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleFileInputClick}
      className={`
        cursor-pointer rounded-xl border-2 border-dashed p-12 md:p-16 text-center transition-all
        ${
          isDragging
            ? "border-[#3b5f9e] bg-blue-50"
            : "border-gray-300 hover:border-[#3b5f9e] hover:bg-gray-50"
        }
        ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <Input
        id={`csv-file-input-${variant}`}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        disabled={isLoading}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto">
        <div
          className={`
            p-6 rounded-full transition-colors
            ${isDragging ? "bg-blue-100" : "bg-gray-100"}
          `}
        >
          <FileSpreadsheet
            className={`
              h-16 w-16 transition-colors
              ${isDragging ? "text-[#3b5f9e]" : "text-gray-400"}
            `}
          />
        </div>

        {selectedFile ? (
          <div className="w-full space-y-4">
            <div>
              <p className="text-lg font-semibold text-gray-700 mb-1">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
              disabled={isLoading}
              size="lg"
              className="w-full max-w-xs mx-auto bg-[#3b5f9e] hover:bg-[#345ca8]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-5 w-5" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-gray-700">
              Drop your CSV file here
            </p>
            <p className="text-base text-gray-500">or click to browse</p>
            <p className="text-sm text-gray-400 pt-2">
              CSV files only • Max 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
