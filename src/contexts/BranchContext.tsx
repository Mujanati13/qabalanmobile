import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/apiService';

export interface BranchInfo {
  id: number;
  title_en?: string;
  title_ar?: string;
  latitude?: number;
  longitude?: number;
  is_active?: boolean;
  branch_id?: number;
  name?: string;
  name_en?: string;
  name_ar?: string;
  display_name?: string;
  title?: string;
}

interface BranchContextValue {
  branches: BranchInfo[];
  selectedBranchId: number | null;
  setSelectedBranchId: (branchId: number | null) => void;
  refreshBranches: () => Promise<void>;
  loading: boolean;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

const STORAGE_KEY = '@selected_branch_id';

const normalizeBranchRecord = (raw: Partial<BranchInfo>): BranchInfo => {
  const branch = { ...raw } as BranchInfo & Record<string, unknown>;

  const normalizeString = (value: unknown): string => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return '';
  };

  const resolveNumericId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  };

  const fallbackId =
    resolveNumericId(branch.id) ??
    resolveNumericId(branch.branch_id) ??
    null;

  const idString = (() => {
    if (fallbackId !== null) {
      return String(fallbackId);
    }
    const stringIdCandidates = [branch.id, branch.branch_id]
      .filter(value => typeof value === 'string') as string[];
    for (const candidate of stringIdCandidates) {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return '';
  })();

  const fallbackTitleEn = idString ? `Branch ${idString}` : 'Branch';
  const fallbackTitleAr = idString ? `الفرع ${idString}` : 'الفرع';

  const titleEnCandidates = [
    branch.title_en,
    branch.name_en,
    branch.display_name,
    branch.name,
    branch.title
  ];
  const titleArCandidates = [
    branch.title_ar,
    branch.name_ar,
    branch.display_name,
    branch.name,
    branch.title
  ];

  const pickFirst = (values: unknown[], fallback: string): string => {
    for (const value of values) {
      const normalized = normalizeString(value);
      if (normalized) {
        return normalized;
      }
    }
    return fallback;
  };

  const derivedId = fallbackId ?? resolveNumericId(branch.id) ?? resolveNumericId(branch.branch_id);

  return {
    ...branch,
    id: derivedId ?? branch.id ?? branch.branch_id ?? 0,
    branch_id: branch.branch_id ?? derivedId ?? branch.id,
    title_en: pickFirst(titleEnCandidates, fallbackTitleEn),
    title_ar: pickFirst(titleArCandidates, fallbackTitleAr),
  } as BranchInfo;
};

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const persistSelection = useCallback(async (branchId: number | null) => {
    try {
      if (branchId === null || Number.isNaN(branchId)) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, String(branchId));
      }
    } catch (error) {
      console.warn('[BranchContext] Failed to persist selected branch:', error);
    }
  }, []);

  const setSelectedBranchId = useCallback(
    (branchId: number | null) => {
      setSelectedBranchIdState(branchId);
      persistSelection(branchId);
    },
    [persistSelection]
  );

  const refreshBranches = useCallback(async (preferredBranchId?: number | null) => {
    setLoading(true);
    try {
      const response = await ApiService.getBranches();
      if (response?.success && Array.isArray(response.data)) {
        const fetchedBranches = (response.data ?? []) as BranchInfo[];
        const normalizedBranches = fetchedBranches.map(normalizeBranchRecord);
        setBranches(normalizedBranches);

        const effectivePreferred = preferredBranchId ?? selectedBranchId;
        const hasPreferred =
          effectivePreferred !== null &&
          normalizedBranches.some(branch => branch.id === effectivePreferred);

        if (hasPreferred && effectivePreferred !== null) {
          setSelectedBranchId(effectivePreferred);
        } else {
          const fallbackId = normalizedBranches.length > 0 ? normalizedBranches[0].id : null;
          setSelectedBranchId(fallbackId);
        }
      } else {
        setBranches([]);
        setSelectedBranchId(null);
      }
    } catch (error) {
      console.error('[BranchContext] Failed to load branches:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, setSelectedBranchId]);

  useEffect(() => {
    const initialize = async () => {
      let preferredBranch: number | null = null;
      try {
        const storedId = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedId) {
          const parsed = Number(storedId);
          if (Number.isFinite(parsed)) {
            preferredBranch = parsed;
            setSelectedBranchIdState(parsed);
          }
        }
      } catch (error) {
        console.warn('[BranchContext] Failed to read stored branch id:', error);
      } finally {
        refreshBranches(preferredBranch ?? undefined);
      }
    };

    initialize();
  }, [refreshBranches]);

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    selectedBranchId,
    setSelectedBranchId,
    refreshBranches,
    loading,
  }), [branches, selectedBranchId, setSelectedBranchId, refreshBranches, loading]);

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = (): BranchContextValue => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
