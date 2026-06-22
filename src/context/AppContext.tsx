import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Dispatch } from 'react';
import type { AppState } from '../domain/types';
import { projectReducer, initialState, type AppAction } from '../domain/projectReducer';
import { saveProject, saveCanvasState } from '../services/storageRepository';

type AppContextType = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => undefined,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Auto-save project on changes
  useEffect(() => {
    if (state.project) {
      saveProject(state.project);
    }
  }, [state.project]);

  // Auto-save canvas on changes
  useEffect(() => {
    if (state.currentProjectId && state.canvas) {
      saveCanvasState(state.currentProjectId, state.canvas);
    }
  }, [state.currentProjectId, state.canvas]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

export function useDispatch() {
  return useContext(AppContext).dispatch;
}

export function useAppState() {
  return useContext(AppContext).state;
}
