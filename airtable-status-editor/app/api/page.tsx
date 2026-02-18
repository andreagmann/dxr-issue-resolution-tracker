'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  type: string;
  thumbnails?: {
    small?: { url: string };
    large?: { url: string };
  };
}

interface Record {
  id: string;
  fields: {
    Issue: string;
    Description: string;
    Screenshot?: AirtableAttachment[];
    Dimension: string;
    Theme: string;
    Status: string;
    Comments: string;
  };
}

type SortField = 'Issue' | 'Description' | 'Dimension' | 'Theme' | 'Status' | 'Comments';
type SortDirection = 'asc' | 'desc';

const STATUS_OPTIONS = [
  'Accepted - Not Planned',
  'Accepted - Planned',
  'Completed',
  'Rejected',
] as const;

const DIMENSION_ORDER = [
  'Getting Started',
  'Usability',
  'Visuals',
  'Content',
  'Help',
];

function getStatusClass(status: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, '-');
  if (normalized.includes('not-planned')) return 'status-accepted-not-planned';
  if (normalized.includes('planned')) return 'status-accepted-planned';
  if (normalized.includes('completed')) return 'status-completed';
  if (normalized.includes('rejected')) return 'status-rejected';
  return 'bg-gray-100 text-gray-800';
}

function SortIcon({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <span className={`ml-1 inline-block ${active ? 'text-gray-700' : 'text-gray-300'}`}>
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function AddCommentIcon() {
  return (
    <svg 
      className="w-5 h-5 text-gray-300 hover:text-gray-400 transition-colors" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </svg>
  );
}

export default function Home() {
  const [records, setRecords] = useState<Record[]>([]);
  const [baseName, setBaseName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('Dimension');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [editingComments, setEditingComments] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const commentsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchRecords();
    fetchBaseName();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedRecord(null);
        setSelectedImage(null);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (selectedRecord) {
      setEditingComments(selectedRecord.fields.Comments || '');
      setTimeout(() => {
        commentsTextareaRef.current?.focus();
      }, 100);
    }
  }, [selectedRecord]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      let aVal = a.fields[sortField] || '';
      let bVal = b.fields[sortField] || '';

      if (sortField === 'Dimension') {
        const aIndex = DIMENSION_ORDER.indexOf(aVal);
        const bIndex = DIMENSION_ORDER.indexOf(bVal);
        const aOrder = aIndex === -1 ? 999 : aIndex;
        const bOrder = bIndex === -1 ? 999 : bIndex;
        return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
      }

      if (sortField === 'Issue') {
        const aNum = parseInt(aVal, 10) || 0;
        const bNum = parseInt(bVal, 10) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }, [records, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  async function fetchBaseName() {
    try {
      const response = await fetch('/api/base');
      if (!response.ok) return;
      const data = await response.json();
      setBaseName(data.name || '');
    } catch (err) {
      console.error('Failed to fetch base name:', err);
    }
  }

  async function fetchRecords() {
    try {
      setLoading(true);
      const response = await fetch('/api/records');
      if (!response.ok) throw new Error('Failed to fetch records');
      const data = await response.json();
      const filtered = data.records.filter(
        (record: Record) => record.fields.Dimension && record.fields.Dimension.trim() !== ''
      );
      setRecords(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function updateRecord(recordId: string, updates: { Status?: string; Comments?: string }) {
    setSavingIds((prev) => new Set(prev).add(recordId));

    setRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? { ...record, fields: { ...record.fields, ...updates } }
          : record
      )
    );

    if (selectedRecord && selectedRecord.id === recordId) {
      setSelectedRecord({
        ...selectedRecord,
        fields: { ...selectedRecord.fields, ...updates },
      });
    }

    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update record');

      setToast({ message: 'Saved successfully', type: 'success' });
    } catch (err) {
      fetchRecords();
      setToast({ message: 'Failed to save', type: 'error' });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  }

  function handleCommentsChange(value: string) {
    setEditingComments(value);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (selectedRecord) {
        updateRecord(selectedRecord.id, { Comments: value });
      }
    }, 1000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg
            className="spinner h-5 w-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-600">Loading records...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchRecords}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg toast-enter z-50 ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Screenshot"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {selectedRecord && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedRecord(null)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Issue #{selectedRecord.fields.Issue}
              </h2>
              <div className="flex items-center gap-2">
                {savingIds.has(selectedRecord.id) && (
                  <span className="text-xs text-gray-400">Saving...</span>
                )}
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <span className={`inline-block text-sm font-medium px-3 py-1 rounded-full ${getStatusClass(selectedRecord.fields.Status || '')}`}>
                  {selectedRecord.fields.Status || 'No status'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Dimension
                </label>
                <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                  {selectedRecord.fields.Dimension}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Theme
                </label>
                <span className="inline-block bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">
                  {selectedRecord.fields.Theme || 'No theme'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedRecord.fields.Description || 'No description'}
                </p>
              </div>

              {selectedRecord.fields.Screenshot && selectedRecord.fields.Screenshot.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Screenshot
                  </label>
                  <button
                    onClick={() =>
                      setSelectedImage(
                        selectedRecord.fields.Screenshot![0].thumbnails?.large?.url ||
                          selectedRecord.fields.Screenshot![0].url
                      )
                    }
                    className="block w-full rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <img
                      src={
                        selectedRecord.fields.Screenshot[0].thumbnails?.large?.url ||
                          selectedRecord.fields.Screenshot[0].url
                      }
                      alt="Screenshot"
                      className="w-full h-auto object-contain"
                    />
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Click to enlarge</p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Update Status
                </label>
                <select
                  value={selectedRecord.fields.Status || ''}
                  onChange={(e) => updateRecord(selectedRecord.id, { Status: e.target.value })}
                  disabled={savingIds.has(selectedRecord.id)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select status
                  </option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Comments
                </label>
                <textarea
                  ref={commentsTextareaRef}
                  value={editingComments}
                  onChange={(e) => handleCommentsChange(e.target.value)}
                  placeholder="Add your comments here..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-saves after you stop typing</p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="max-w-7xl mx-auto mb-8">
        {baseName && (
          <p className="text-sm font-semibold tracking-wide mb-1" style={{ color: '#0070F2' }}>
            {baseName}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-gray-900">Issue Status Editor</h1>
        <p className="text-gray-500 mt-1">
          {sortedRecords.length} issue{sortedRecords.length !== 1 ? 's' : ''} found. Click a row to see details and edit comments.
        </p>
      </div>

      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th
                  onClick={() => handleSort('Issue')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Issue
                  <SortIcon direction={sortDirection} active={sortField === 'Issue'} />
                </th>
                <th
                  onClick={() => handleSort('Description')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Description
                  <SortIcon direction={sortDirection} active={sortField === 'Description'} />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Screenshot
                </th>
                <th
                  onClick={() => handleSort('Dimension')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Dimension
                  <SortIcon direction={sortDirection} active={sortField === 'Dimension'} />
                </th>
                <th
                  onClick={() => handleSort('Theme')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Theme
                  <SortIcon direction={sortDirection} active={sortField === 'Theme'} />
                </th>
                <th
                  onClick={() => handleSort('Status')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Status
                  <SortIcon direction={sortDirection} active={sortField === 'Status'} />
                </th>
                <th
                  onClick={() => handleSort('Comments')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Comments
                  <SortIcon direction={sortDirection} active={sortField === 'Comments'} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRecords.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="table-row-hover transition-colors cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">
                      {record.fields.Issue || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 text-sm line-clamp-2 max-w-xs">
                      {record.fields.Description || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {record.fields.Screenshot && record.fields.Screenshot.length > 0 ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={
                            record.fields.Screenshot[0].thumbnails?.small?.url ||
                            record.fields.Screenshot[0].url
                          }
                          alt="Screenshot thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No image</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 text-sm">
                      {record.fields.Dimension || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 text-sm">
                      {record.fields.Theme || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={record.fields.Status || ''}
                        onChange={(e) => updateRecord(record.id, { Status: e.target.value })}
                        disabled={savingIds.has(record.id)}
                        className={`status-dropdown text-sm font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-wait ${getStatusClass(
                          record.fields.Status || ''
                        )}`}
                      >
                        <option value="" disabled>
                          Select status
                        </option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {savingIds.has(record.id) && (
                        <div className="absolute right-8 top-1/2 -translate-y-1/2">
                          <svg
                            className="spinner h-4 w-4 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {record.fields.Comments ? (
                      <span className="text-gray-600 text-sm line-clamp-2 max-w-xs">
                        {record.fields.Comments}
                      </span>
                    ) : (
                      <AddCommentIcon />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
