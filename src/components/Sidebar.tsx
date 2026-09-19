import { useRef, useState } from 'react';
import type { DocumentRecord } from '../types';

interface SidebarProps {
  documents: DocumentRecord[];
  onUpload: (files: File[]) => void;
  onDelete: (docId: string) => void;
  selectedDocId: string | null;
  onSelectDoc: (docId: string | null) => void;
  onShowEvaluation: () => void;
}

export function Sidebar({
  documents,
  onUpload,
  onDelete,
  selectedDocId,
  onSelectDoc,
  onShowEvaluation,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const pdfFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) return;
    setUploading(true);
    onUpload(pdfFiles);
    setUploading(false);
  };

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    pending: { label: 'Pending', color: 'text-yellow-400', dot: 'bg-yellow-400' },
    processing: { label: 'Processing', color: 'text-cyan-400', dot: 'bg-cyan-400 animate-pulse' },
    ready: { label: 'Ready', color: 'text-green-400', dot: 'bg-green-400' },
    failed: { label: 'Failed', color: 'text-red-400', dot: 'bg-red-400' },
  };

  return (
    <aside className="flex w-80 flex-col border-r border-navy-700 bg-navy-900">
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5 border-b border-navy-700 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800">
          <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m-6-8h6M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide text-white">PROJECT1</h1>
          <p className="text-xs text-navy-400">Knowledge Assistant</p>
        </div>
      </div>

      {/* Upload area */}
      <div className="p-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFileSelect(e.dataTransfer.files);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-400/10'
              : 'border-navy-600 hover:border-navy-500 hover:bg-navy-800/50'
          }`}
        >
          <svg className="mx-auto mb-2 h-8 w-8 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.66 6M21 7l-3 3m0-3l3 3" />
          </svg>
          <p className="text-sm font-medium text-navy-200">
            {uploading ? 'Uploading...' : 'Upload PDFs'}
          </p>
          <p className="mt-0.5 text-xs text-navy-400">Drag & drop or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
            Document Library
          </h2>
          <span className="text-xs text-navy-400">{documents.length}</span>
        </div>

        {documents.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-navy-400">No documents yet</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((doc) => {
              const status = statusConfig[doc.status] || statusConfig.pending;
              const isSelected = doc.id === selectedDocId;
              return (
                <li
                  key={doc.id}
                  onClick={() => onSelectDoc(doc.id)}
                  className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-cyan-400/40 bg-cyan-400/5'
                      : 'border-transparent hover:border-navy-600 hover:bg-navy-800/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-800">
                      <svg className="h-4 w-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-100" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        {doc.status === 'ready' && doc.total_pages != null && (
                          <span className="text-xs text-navy-400">
                            {doc.total_pages}p · {doc.total_chunks} chunks
                          </span>
                        )}
                      </div>
                      {doc.status === 'failed' && doc.error_message && (
                        <p className="mt-1 text-xs text-red-400/70 line-clamp-2" title={doc.error_message}>
                          {doc.error_message}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(doc.id);
                      }}
                      className="shrink-0 rounded p-1 text-navy-500 opacity-0 transition-all hover:bg-navy-700 hover:text-red-400 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Evaluation button */}
      <div className="border-t border-navy-700 p-3">
        <button
          onClick={onShowEvaluation}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-medium text-navy-200 transition-all hover:bg-navy-700 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Evaluation
        </button>
      </div>
    </aside>
  );
}
