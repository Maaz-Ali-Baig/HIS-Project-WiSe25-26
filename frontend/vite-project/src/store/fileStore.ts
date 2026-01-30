import { create } from 'zustand';

export type ColumnTypeFilter = "all" | "categorical" | "numeric";

export interface FileEdit {
  rowId: string;
  changes: Record<string, string>;
}

export interface FileState {
  fileId: string | null;
  userId: string | null;
  columns: string[];
  rows: Array<Record<string, string>>;
  pendingEdits: Map<string, Record<string, string>>;
  status: 'clean' | 'dirty' | 'loading' | 'saving';
  updatedAt: string;
  editingCell: { rowId: string; column: string } | null;
  selectionRanges: Array<{ start: number; end: number }>;
  totalColumns: number;
  modifiedCells: Array<{ rowId: string; column: string }>;
  columnTypeFilter: ColumnTypeFilter;
}

interface FileActions {
  setFile: (fileId: string, userId: string, columns: string[], rows: Array<Record<string, string>>, updatedAt: string, selectionRanges?: Array<{ start: number; end: number }>, totalColumns?: number, modifiedCells?: Array<{ rowId: string; column: string }>, columnTypeFilter?: ColumnTypeFilter) => void;
  startEditing: (rowId: string, column: string, initialValue: string) => void;
  applyEdit: (rowId: string, column: string, value: string) => void;
  discardEdits: () => void;
  markSaved: (rows: Array<Record<string, string>>, updatedAt: string) => void;
  updateColumnSelection: (columns: string[], rows: Array<Record<string, string>>, updatedAt: string, selectionRanges: Array<{ start: number; end: number }>, totalColumns: number, columnTypeFilter: ColumnTypeFilter) => void;
  setLoading: () => void;
  setSaving: () => void;
  reset: () => void;
}

type FileStore = FileState & FileActions;

const initialState: FileState = {
  fileId: null,
  userId: null,
  columns: [],
  rows: [],
  pendingEdits: new Map(),
  status: 'clean',
  updatedAt: '',
  editingCell: null,
  selectionRanges: [],
  totalColumns: 0,
  modifiedCells: [],
  columnTypeFilter: 'all',
};

export const useFileStore = create<FileStore>((set, get) => ({
  ...initialState,

  setFile: (fileId, userId, columns, rows, updatedAt, selectionRanges = [], totalColumns = 0, modifiedCells = [], columnTypeFilter = 'all') => {
    set({
      fileId,
      userId,
      columns,
      rows,
      pendingEdits: new Map(),
      status: 'clean',
      updatedAt,
      editingCell: null,
      selectionRanges,
      totalColumns: totalColumns || columns.length,
      modifiedCells,
      columnTypeFilter,
    });
  },

  startEditing: (rowId, column, initialValue) => {
    // Prevent editing the id column
    if (column === 'id') {
      console.log('🚫 Store: Cannot edit id column');
      return;
    }

    console.log('🎬 Store: startEditing', { rowId, column, initialValue });
    set({
      editingCell: { rowId, column },
    });
  },

  applyEdit: (rowId, column, value) => {
    // Prevent editing the id column
    if (column === 'id') {
      console.log('🚫 Store: Cannot edit id column');
      return;
    }

    console.log('🏪 Store: applyEdit called', { rowId, column, value });
    const { pendingEdits } = get();
    const newEdits = new Map(pendingEdits);

    // Get existing edits for this row or create new
    const rowEdits = newEdits.get(rowId) || {};
    console.log('📦 Store: existing rowEdits', { rowId, rowEdits });
    rowEdits[column] = value;
    newEdits.set(rowId, rowEdits);
    console.log('✨ Store: updated pendingEdits', {
      rowId,
      newRowEdits: rowEdits,
      totalEdits: newEdits.size
    });

    set({
      pendingEdits: newEdits,
      status: 'dirty',
      editingCell: null,
    });
  },

  discardEdits: () => {
    set({
      pendingEdits: new Map(),
      status: 'clean',
    });
  },

  markSaved: (rows, updatedAt) => {
    set({
      rows,
      pendingEdits: new Map(),
      status: 'clean',
      updatedAt,
    });
  },

  setLoading: () => {
    set({ status: 'loading' });
  },

  setSaving: () => {
    set({ status: 'saving' });
  },

  updateColumnSelection: (columns, rows, updatedAt, selectionRanges, totalColumns, columnTypeFilter) => {
    const state = get();
    set({
      columns,
      rows,
      selectionRanges,
      totalColumns,
      updatedAt,
      columnTypeFilter,
      pendingEdits: new Map(),
      status: 'clean',
      editingCell: null,
      // Preserve modifiedCells when updating column selection
      modifiedCells: state.modifiedCells,
    });
  },

  reset: () => {
    set(initialState);
  },
}));
