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
    'Issue ID': string;
    Issue: string;
    Description: string;
    Screenshot?: AirtableAttachment[];
    Dimension: string;
    Theme: string;
    Decision: string;
    Resolution: string;
    Comments: string;
  };
}

type SortField = 'Issue ID' | 'Issue' | 'Description' | 'Dimension' | 'Theme' | 'Decision' | 'Resolution' | 'Comments';
type SortDirection = 'asc' | 'desc';

const DECISION_OPTIONS = ['Accepted', 'Rejected'] as const;

const RESOLUTION_OPTIONS = [
  'Not Planned Yet',
  'Planned',
  'Completed',
  'Redirected',
] as const;

const DIMENSION_ORDER = [
  'Getting Started',
  'Usability',
  'Visuals',
  'Content',
  'Help',
];

function getDecisionClass(decision: string): string {
  switch (decision) {
    case 'Accepted':
      return 'bg-green-100 text-green-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getResolutionClass(resolution: string): string {
  switch (resolution) {
    case 'Not Planned Yet':
      return 'bg-amber-100 text-amber-800';
    case 'Planned':
      return 'bg-blue-100 text-blue-800';
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'Redirected':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
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
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-gray-300 hover:text-gray-500 transition-colors mx-auto"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export default function Home() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sortField, setSortField] = useState<SortField>('Issue ID');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [editingComments, setEditingComments] = useState('');
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  // const [baseName, setBaseName] = useState<string>('');
  const [focusComments, setFocusComments] = useState(false);
  const commentsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRecords();
    // fetchBaseName();
  }, []);

  useEffect(() => {
    if (selectedRecord) {
      setEditingComments(selectedRecord.fields.Comments || '');
      if (!focusComments && panelRef.current) {
        panelRef.current.scrollTop = 0;
      }
      if (focusComments) {
        setTimeout(() => {
          if (commentsTextareaRef.current) {
            commentsTextareaRef.current.focus();
            commentsTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          setFocusComments(false);
        }, 300);
      }
    }
  }, [selectedRecord]);

  useEffect(() => {
    if (focusComments && selectedRecord) {
      setTimeout(() => {
        if (commentsTextareaRef.current) {
          commentsTextareaRef.current.focus();
          commentsTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setFocusComments(false);
      }, 300);
    }
  }, [focusComments]);

  // async function fetchBaseName() {
  //   try {
  //     const res = await fetch('/api/base');
  //     if (res.ok) {
  //       const data = await res.json();
  //       setBaseName(data.name || '');
  //     }
  //   } catch (e) {
  //     // Silently fail
  //   }
  // }

  async function fetchRecords() {
    try {
      const res = await fetch('/api/records');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data.records);
    } catch (err) {
      setError('Failed to load records from Airtable');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function updateRecord(recordId: string, fields: Partial<Record['fields']>) {
    const previousRecords = [...records];

    // Optimistic update
    setRecords((prev) =>
      prev.map((r) =>
        r.id === recordId ? { ...r, fields: { ...r.fields, ...fields } } : r
      )
    );
    if (selectedRecord?.id === recordId) {
      setSelectedRecord((prev) =>
        prev ? { ...prev, fields: { ...prev.fields, ...fields } } : prev
      );
    }

    setSavingIds((prev) => new Set(prev).add(recordId));

    try {
      const res = await fetch(`/api/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      if (!res.ok) throw new Error('Failed to update');
      showToast('Saved', 'success');
    } catch (err) {
      setRecords(previousRecords);
      if (selectedRecord?.id === recordId) {
        const original = previousRecords.find((r) => r.id === recordId);
        if (original) setSelectedRecord(original);
      }
      showToast('Failed to save', 'error');
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
    if (commentsTimeoutRef.current) clearTimeout(commentsTimeoutRef.current);
    commentsTimeoutRef.current = setTimeout(() => {
      if (selectedRecord) {
        updateRecord(selectedRecord.id, { Comments: value });
      }
    }, 1000);
  }

  function handleDecisionChange(recordId: string, value: string) {
    const fields: Partial<Record['fields']> = { Decision: value };
    // If decision changes to Rejected, clear Resolution
    if (value === 'Rejected') {
      fields.Resolution = '';
    }
    updateRecord(recordId, fields);
  }

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const aRaw = (a.fields as any)[sortField];
      const bRaw = (b.fields as any)[sortField];

      if (sortField === 'Issue ID' || sortField === 'Issue') {
        const aNum = typeof aRaw === 'number' ? aRaw : parseInt(String(aRaw || '').replace(/\D/g, ''), 10) || 0;
        const bNum = typeof bRaw === 'number' ? bRaw : parseInt(String(bRaw || '').replace(/\D/g, ''), 10) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aVal = String(aRaw || '');
      const bVal = String(bRaw || '');

      if (sortField === 'Dimension') {
        const aIndex = DIMENSION_ORDER.indexOf(aVal);
        const bIndex = DIMENSION_ORDER.indexOf(bVal);
        const aOrder = aIndex === -1 ? 999 : aIndex;
        const bOrder = bIndex === -1 ? 999 : bIndex;
        return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
      }

      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }, [records, sortField, sortDirection]);

  const currentIndex = useMemo(() => {
    if (!selectedRecord) return -1;
    return sortedRecords.findIndex((r) => r.id === selectedRecord.id);
  }, [selectedRecord, sortedRecords]);

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < sortedRecords.length - 1 && currentIndex !== -1;

  function goToPrevious() {
    if (canGoPrevious) {
      setFocusComments(false);
      setSelectedRecord(sortedRecords[currentIndex - 1]);
    }
  }

  function goToNext() {
    if (canGoNext) {
      setFocusComments(false);
      setSelectedRecord(sortedRecords[currentIndex + 1]);
    }
  }

  function selectRecord(record: Record, focusOnComments: boolean = false) {
    if (focusOnComments) {
      setFocusComments(true);
    }
    setSelectedRecord(record);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function closePanel() {
    if (commentsTimeoutRef.current) {
      clearTimeout(commentsTimeoutRef.current);
      if (selectedRecord && editingComments !== (selectedRecord.fields.Comments || '')) {
        updateRecord(selectedRecord.id, { Comments: editingComments });
      }
    }
    setSelectedRecord(null);
    setFocusComments(false);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (enlargedImage) {
          setEnlargedImage(null);
        } else if (selectedRecord) {
          closePanel();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRecord, enlargedImage, editingComments]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="spinner h-8 w-8 text-blue-500 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-500">Loading issues...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchRecords();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <style jsx global>{`
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .status-dropdown {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 14px;
          padding-right: 28px;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Enlarged image modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <img src={enlargedImage} alt="Enlarged screenshot" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Side panel */}
      {selectedRecord && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-20 z-30" onClick={closePanel} />
          <div
            ref={panelRef}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-40 overflow-y-auto"
          >
            <div className="p-6 space-y-5">
              {/* Header with close + navigation */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Issue ID: {selectedRecord.fields['Issue ID']}
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900 break-words mt-1">
                    {selectedRecord.fields.Issue}
                  </h2>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <button
                      onClick={goToPrevious}
                      disabled={!canGoPrevious}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Previous issue"
                    >
                      ←
                    </button>
                    <span>
                      {currentIndex + 1} / {sortedRecords.length}
                    </span>
                    <button
                      onClick={goToNext}
                      disabled={!canGoNext}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next issue"
                    >
                      →
                    </button>
                  </div>
                </div>
                <button
                  onClick={closePanel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Editable action area */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Decision
                    </label>
                    <select
                      value={selectedRecord.fields.Decision || ''}
                      onChange={(e) => handleDecisionChange(selectedRecord.id, e.target.value)}
                      disabled={savingIds.has(selectedRecord.id)}
                      className={`w-full status-dropdown text-sm font-medium px-3 py-2 rounded-lg border border-gray-300 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-wait ${getDecisionClass(selectedRecord.fields.Decision || '')}`}
                    >
                      <option value="" disabled>
                        Select decision
                      </option>
                      {DECISION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Resolution
                    </label>
                    <select
                      value={selectedRecord.fields.Resolution || ''}
                      onChange={(e) => updateRecord(selectedRecord.id, { Resolution: e.target.value })}
                      disabled={savingIds.has(selectedRecord.id) || selectedRecord.fields.Decision !== 'Accepted'}
                      className={`w-full status-dropdown text-sm font-medium px-3 py-2 rounded-lg border border-gray-300 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-wait ${
                        selectedRecord.fields.Decision === 'Accepted'
                          ? getResolutionClass(selectedRecord.fields.Resolution || '')
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      <option value="" disabled>
                        {selectedRecord.fields.Decision === 'Accepted' ? 'Select resolution' : 'Requires accepted decision'}
                      </option>
                      {RESOLUTION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Comments
                  </label>
                  <textarea
                    ref={commentsTextareaRef}
                    value={editingComments}
                    onChange={(e) => handleCommentsChange(e.target.value)}
                    placeholder="Add your comments here..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y text-sm bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-saves after you stop typing</p>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-gray-200" />

              {/* Read-only fields */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Dimension
                </label>
                <p className="text-sm text-gray-900">{selectedRecord.fields.Dimension || '—'}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Theme
                </label>
                <p className="text-sm text-gray-900">{selectedRecord.fields.Theme || '—'}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Description
                </label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedRecord.fields.Description || '—'}
                </p>
              </div>

              {/* Screenshot */}
              {selectedRecord.fields.Screenshot && selectedRecord.fields.Screenshot.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Screenshot
                  </label>
                  <button
                    onClick={() =>
                      setEnlargedImage(
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
            </div>
          </div>
        </>
      )}

      {/* Page header */}
      <div className="mb-8">
        {/* {baseName && (
          <p className="text-sm font-semibold tracking-wide mb-1" style={{ color: '#0070F2' }}>
            {baseName}
          </p>
        )} */}
        <h1 className="text-2xl font-semibold text-gray-900">Issue Status Editor</h1>
        <p className="text-gray-500 mt-1">
          {sortedRecords.length} issue{sortedRecords.length !== 1 ? 's' : ''} found. Click a row to see details.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th
                  onClick={() => handleSort('Issue ID')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap w-px"
                >
                  Issue ID
                  <SortIcon direction={sortDirection} active={sortField === 'Issue ID'} />
                </th>
                <th
                  onClick={() => handleSort('Issue')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-[15%]"
                >
                  Issue
                  <SortIcon direction={sortDirection} active={sortField === 'Issue'} />
                </th>
                <th
                  onClick={() => handleSort('Description')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-[20%]"
                >
                  Description
                  <SortIcon direction={sortDirection} active={sortField === 'Description'} />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-px">
                  Screenshot
                </th>
                <th
                  onClick={() => handleSort('Dimension')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap w-px"
                >
                  Dimension
                  <SortIcon direction={sortDirection} active={sortField === 'Dimension'} />
                </th>
                <th
                  onClick={() => handleSort('Theme')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap w-px"
                >
                  Theme
                  <SortIcon direction={sortDirection} active={sortField === 'Theme'} />
                </th>
                <th
                  onClick={() => handleSort('Decision')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap w-px"
                >
                  Decision
                  <SortIcon direction={sortDirection} active={sortField === 'Decision'} />
                </th>
                <th
                  onClick={() => handleSort('Resolution')}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap w-px"
                >
                  Resolution
                  <SortIcon direction={sortDirection} active={sortField === 'Resolution'} />
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
            <tbody>
              {sortedRecords.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => selectRecord(record)}
                  className={`border-b border-gray-100 cursor-pointer transition-colors ${
                    selectedRecord?.id === record.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                    {record.fields['Issue ID']}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {record.fields.Issue}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {record.fields.Description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.fields.Screenshot && record.fields.Screenshot.length > 0 && (
                      <img
                        src={record.fields.Screenshot[0].thumbnails?.small?.url || record.fields.Screenshot[0].url}
                        alt="thumb"
                        className="h-8 w-12 object-cover rounded border border-gray-200"
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {record.fields.Dimension}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {record.fields.Theme}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <select
                        value={record.fields.Decision || ''}
                        onChange={(e) => handleDecisionChange(record.id, e.target.value)}
                        disabled={savingIds.has(record.id)}
                        className={`status-dropdown text-sm font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-wait ${getDecisionClass(
                          record.fields.Decision || ''
                        )}`}
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        {DECISION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
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
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <select
                        value={record.fields.Resolution || ''}
                        onChange={(e) => updateRecord(record.id, { Resolution: e.target.value })}
                        disabled={savingIds.has(record.id) || record.fields.Decision !== 'Accepted'}
                        className={`status-dropdown text-sm font-medium px-3 py-1.5 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-wait ${
                          record.fields.Decision === 'Accepted'
                            ? getResolutionClass(record.fields.Resolution || '')
                            : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        <option value="" disabled>
                          {record.fields.Decision === 'Accepted' ? 'Select' : '—'}
                        </option>
                        {RESOLUTION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td
                    className="px-6 py-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectRecord(record, true);
                    }}
                  >
                    {record.fields.Comments ? (
                      <span className="text-gray-600 text-sm line-clamp-2">
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
