import { create } from "zustand";

interface ImportUiState {
  open: boolean;
  openWizard: () => void;
  closeWizard: () => void;
}

export const useImportStore = create<ImportUiState>((set) => ({
  open: false,
  openWizard: () => set({ open: true }),
  closeWizard: () => set({ open: false }),
}));
