// frontend/src/EncodingForm.jsx
import React, { useState } from "react";
import { useFileStore } from "../../../store/fileStore";

export default function EncodingForm() {
  const fileStore = useFileStore(); // Zustand store
  const [selectedEncoding, setSelectedEncoding] = useState<string | null>(null);
  const [selectedTargetColumns, setSelectedTargetColumns] = useState<string[]>(
    []
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Encoding options
  const encodingOptions = ["label", "ordinal", "frequency", "target"];

  // Example columns from fileStore (replace with your actual columns)
  // const columns = fileStore.columns || ["age", "gender", "country", "salary"];
  const columns = fileStore.columns || ["age", "gender", "country", "salary"];

  console.log("File Store:", fileStore.fileId);

  // When an encoding chip is clicked
  const handleEncodingClick = (encoding: string) => {
    setSelectedEncoding(encoding);

    // Reset target columns when switching away from target encoding
    if (encoding !== "target") {
      setSelectedTargetColumns([]);
    }
  };

  // Multi-select toggle for target columns
  const toggleTargetColumn = (col: string) => {
    setSelectedTargetColumns(
      (prev) =>
        prev.includes(col)
          ? prev.filter((c) => c !== col) // deselect
          : [...prev, col] // select
    );
  };

  // Submit encoding request to backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!fileStore.userId || !fileStore.fileId) {
      setMessage("userId and fileId are required");
      return;
    }

    if (!selectedEncoding) {
      setMessage("Please select an encoding type");
      return;
    }

    if (selectedEncoding === "target" && selectedTargetColumns.length === 0) {
      setMessage("Please select at least one target column");
      return;
    }

    setBusy(true);

    try {
      const resp = await fetch("http://localhost:8000/api/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: fileStore.userId,
          fileId: fileStore.fileId,
          encodingType: selectedEncoding,
          targetColumns: selectedTargetColumns,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        setMessage("Error: " + (err.detail || JSON.stringify(err)));
        setBusy(false);
        return;
      }

      // Download CSV
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "encoded_output.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setMessage("Download started");
    } catch (err: any) {
      setMessage("Request failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4">
      {/* <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(fileStore, null, 2)}
      </pre> */}
      <h3 className="text-xl font-bold mb-4">Run CSV Encoding</h3>

      {/* Encoding Chips */}
      <div className="flex flex-wrap gap-3 mb-4">
        {encodingOptions.map((enc) => (
          <span
            key={enc}
            onClick={() => handleEncodingClick(enc)}
            className={`px-4 py-2 rounded-xl text-sm cursor-pointer border
              ${
                selectedEncoding === enc
                  ? "bg-indigo-500 text-white border-indigo-600"
                  : "bg-[#E7EAFF] text-black border-[#CCD6F4] hover:bg-[#D2DAFF]"
              }`}
          >
            {enc}
          </span>
        ))}
      </div>

      {/* Target Column Chips (multi-select) */}
      {selectedEncoding === "target" && (
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Select Target Columns</h4>
          <div className="flex flex-wrap gap-3">
            {columns.map((col) => (
              <span
                key={col}
                onClick={() => toggleTargetColumn(col)}
                className={`px-4 py-2 rounded-xl text-sm cursor-pointer border
                  ${
                    selectedTargetColumns.includes(col)
                      ? "bg-green-500 text-white border-green-600"
                      : "bg-[#E7EAFF] text-black border-[#CCD6F4] hover:bg-[#D2DAFF]"
                  }`}
              >
                {col}
              </span>
            ))}
          </div>
          {selectedTargetColumns.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {selectedTargetColumns.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={busy}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {busy ? "Processing..." : "Run Encoding"}
      </button>

      {/* Message */}
      {message && <p className="mt-3 text-red-600">{message}</p>}
    </form>
  );
}
