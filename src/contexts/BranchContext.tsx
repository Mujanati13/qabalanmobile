import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';
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
  distance_km?: number;
  driving_duration?: string; // Google Maps estimated driving time (e.g., "15 mins")
  calculation_method?: string; // 'google_maps_driving' | 'haversine_fallback' | 'haversine_direct'
}

interface BranchContextValue {
  branches: BranchInfo[];
  selectedBranchId: number | null;
  setSelectedBranchId: (branchId: number | null) => void;
  refreshBranches: () => Promise<void>;
  loading: boolean;
  selectNearestBranch: () => Promise<void>;
  autoSelectEnabled: boolean;
  setAutoSelectEnabled: (enabled: boolean) => void;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

const STORAGE_KEY = '@selected_branch_id';
const AUTO_SELECT_KEY = '@branch_auto_select_enabled';

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
  const [autoSelectEnabled, setAutoSelectEnabledState] = useState<boolean>(true);

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

  const setAutoSelectEnabled = useCallback(async (enabled: boolean) => {
    setAutoSelectEnabledState(enabled);
    try {
      await AsyncStorage.setItem(AUTO_SELECT_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.warn('[BranchContext] Failed to persist auto-select setting:', error);
    }
  }, []);

  const setSelectedBranchId = useCallback(
    (branchId: number | null) => {
      setSelectedBranchIdState(branchId);
      persistSelection(branchId);
    },
    [persistSelection]
  );

  const selectNearestBranch = useCallback(async () => {
    try {
      console.log('[BranchContext] Selecting nearest branch based on location...');
      
      // Request location permission if needed
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('[BranchContext] Location permission denied');
          return;
        }
      }

      // Get current location
      Geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('[BranchContext] Got location:', { latitude, longitude });

          try {
            const response = await ApiService.getNearestBranch(latitude, longitude);
            if (response.success && response.data?.nearest_branch) {
              const nearestBranch = response.data.nearest_branch;
              const durationInfo = nearestBranch.driving_duration ? `, ~${nearestBranch.driving_duration}` : '';
              const methodInfo = nearestBranch.calculation_method ? ` [${nearestBranch.calculation_method}]` : '';
              console.log('[BranchContext] Nearest branch:', nearestBranch.title_en, `(${nearestBranch.distance_km.toFixed(2)} km${durationInfo})${methodInfo}`);
              setSelectedBranchId(nearestBranch.id);
            }
          } catch (error) {
            console.error('[BranchContext] Failed to get nearest branch:', error);
          }
        },
        (error) => {
          console.error('[BranchContext] Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (error) {
      console.error('[BranchContext] Error in selectNearestBranch:', error);
    }
  }, [setSelectedBranchId]);

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
      let shouldAutoSelect = true;
      
      try {
        const [storedId, autoSelectSetting] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(AUTO_SELECT_KEY),
        ]);
        
        if (autoSelectSetting !== null) {
          shouldAutoSelect = autoSelectSetting === 'true';
          setAutoSelectEnabledState(shouldAutoSelect);
        }
        
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
        await refreshBranches(preferredBranch ?? undefined);
        
        // If auto-select is enabled and no branch was stored, select nearest
        if (shouldAutoSelect && !preferredBranch) {
          setTimeout(() => {
            selectNearestBranch();
          }, 1000); // Small delay to allow branches to load
        }
      }
    };

    initialize();
  }, [refreshBranches, selectNearestBranch]);

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    selectedBranchId,
    setSelectedBranchId,
    refreshBranches,
    loading,
    selectNearestBranch,
    autoSelectEnabled,
    setAutoSelectEnabled,
  }), [branches, selectedBranchId, setSelectedBranchId, refreshBranches, loading, selectNearestBranch, autoSelectEnabled, setAutoSelectEnabled]);

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
