import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/services/api";

interface ColumnInfo {
  name: string;
  type: string;
  duckdb_type: string;
}

interface UploadResult {
  file_id: string;
  filename: string;
  size: number;
  content_type: string;
  path: string;
}

interface SchemaResult {
  columns: ColumnInfo[];
  row_count: number;
}

interface IngestResult {
  table_name: string;
  columns: ColumnInfo[];
  row_count: number;
}

type Step = "select" | "uploading" | "preview" | "ingesting" | "done";

const ALLOWED_EXTENSIONS = [".csv", ".json", ".parquet", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 500 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function deriveTableName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return base.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]+/, "");
}

function UploadPage() {
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Schema preview state
  const [schema, setSchema] = useState<SchemaResult | null>(null);
  const [tableName, setTableName] = useState("");

  // Ingestion result
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);

  // Workspace ID
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ id: string; name: string }[]>("/api/workspaces/")
      .then((res) => {
        if (res.data.length > 0) {
          setWorkspaceId(res.data[0].id);
        }
      })
      .catch(() => {
        /* workspace fetch failed — will show error on upload */
      });
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatBytes(file.size)}). Maximum is 500 MB.`;
    }
    if (file.size === 0) {
      return "File is empty.";
    }
    return null;
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setError("");
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (!workspaceId) {
        setError("No workspace available. Please create a workspace first.");
        return;
      }

      setSelectedFile(file);
      setStep("uploading");
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspace_id", workspaceId);

      try {
        const uploadRes = await api.post<UploadResult>(
          "/api/data/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (e) => {
              if (e.total) {
                setUploadProgress(Math.round((e.loaded / e.total) * 100));
              }
            },
          },
        );
        setUploadResult(uploadRes.data);

        // Detect schema
        const schemaRes = await api.post<SchemaResult>(
          "/api/data/detect-schema",
          {
            file_path: uploadRes.data.path,
            workspace_id: workspaceId,
          },
        );
        setSchema(schemaRes.data);
        setTableName(deriveTableName(file.name));
        setStep("preview");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Upload failed";
        const axiosDetail =
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          typeof (err as Record<string, unknown>).response === "object" &&
          (err as Record<string, unknown>).response !== null &&
          "data" in
            ((err as Record<string, unknown>).response as Record<
              string,
              unknown
            >) &&
          typeof (
            (err as Record<string, unknown>).response as Record<
              string,
              unknown
            >
          ).data === "object" &&
          (
            (err as Record<string, unknown>).response as Record<
              string,
              unknown
            >
          ).data !== null &&
          "detail" in
            ((
              (err as Record<string, unknown>).response as Record<
                string,
                unknown
              >
            ).data as Record<string, unknown>)
            ? String(
                (
                  (
                    (err as Record<string, unknown>).response as Record<
                      string,
                      unknown
                    >
                  ).data as Record<string, unknown>
                ).detail,
              )
            : null;
        setError(axiosDetail ?? msg);
        setStep("select");
      }
    },
    [workspaceId, validateFile],
  );

  const handleIngest = useCallback(async () => {
    if (!uploadResult || !workspaceId || !tableName.trim()) return;

    setStep("ingesting");
    setError("");

    try {
      const res = await api.post<IngestResult>("/api/data/ingest", {
        file_path: uploadResult.path,
        workspace_id: workspaceId,
        table_name: tableName.trim(),
      });
      setIngestResult(res.data);
      setStep("done");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Ingestion failed";
      setError(msg);
      setStep("preview");
    }
  }, [uploadResult, workspaceId, tableName]);

  const handleReset = useCallback(() => {
    setStep("select");
    setError("");
    setUploadProgress(0);
    setUploadResult(null);
    setSelectedFile(null);
    setSchema(null);
    setTableName("");
    setIngestResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleUpload],
  );

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Upload Data</h1>
      <p className="mt-1 text-gray-600">
        Import CSV, JSON, Parquet, or Excel files
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Step 1: File selection with drag-and-drop */}
      {step === "select" && (
        <div
          data-testid="drop-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          <svg
            className="mb-3 h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700">
            Drag and drop a file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-gray-500">
            CSV, JSON, Parquet, Excel (max 500 MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.parquet,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="file-input"
          />
        </div>
      )}

      {/* Step 2: Upload progress */}
      {step === "uploading" && selectedFile && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-700">
            Uploading {selectedFile.name}...
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${uploadProgress}%` }}
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">{uploadProgress}%</p>
        </div>
      )}

      {/* Step 3: Schema preview + table naming */}
      {step === "preview" && schema && uploadResult && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {uploadResult.filename}
                </h2>
                <p className="text-sm text-gray-500">
                  {formatBytes(uploadResult.size)} &middot;{" "}
                  {schema.row_count.toLocaleString()} rows &middot;{" "}
                  {schema.columns.length} columns
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4">
              <label
                htmlFor="table-name"
                className="block text-sm font-medium text-gray-700"
              >
                Table name
              </label>
              <input
                id="table-name"
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700">
                Detected Schema
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 pr-4 font-medium text-gray-600">
                        Column
                      </th>
                      <th className="pb-2 pr-4 font-medium text-gray-600">
                        Type
                      </th>
                      <th className="pb-2 font-medium text-gray-600">
                        DuckDB Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.columns.map((col) => (
                      <tr
                        key={col.name}
                        className="border-b border-gray-100"
                      >
                        <td className="py-2 pr-4 font-mono text-gray-900">
                          {col.name}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {col.type}
                        </td>
                        <td className="py-2 font-mono text-xs text-gray-500">
                          {col.duckdb_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="button"
              onClick={handleIngest}
              disabled={!tableName.trim()}
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Confirm &amp; Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3b: Ingesting spinner */}
      {step === "ingesting" && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-700">
            Importing data...
          </p>
        </div>
      )}

      {/* Step 4: Success */}
      {step === "done" && ingestResult && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-800">
            Import Successful
          </h2>
          <p className="mt-1 text-sm text-green-700">
            Table <span className="font-mono">{ingestResult.table_name}</span>{" "}
            created with {ingestResult.row_count.toLocaleString()} rows and{" "}
            {ingestResult.columns.length} columns.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
