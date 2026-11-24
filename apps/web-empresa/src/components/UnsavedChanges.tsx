import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';

import { ConfirmDialog } from './ConfirmDialog';

type Registry = { set: (key: string, dirty: boolean) => void };

const UnsavedChangesContext = createContext<Registry | null>(null);

/**
 * Pergunta "Sair sem salvar?" quando a pessoa tenta sair de uma tela com alterações não salvas: link do menu, botão
 * Voltar do navegador ou mudança de rota. Fechar ou recarregar a aba usa o aviso nativo do navegador. Precisa ficar
 * dentro de um roteador de dados (createBrowserRouter). Cada formulário se registra com `useUnsavedChanges`.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyKeys = useRef(new Set<string>());

  const set = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
  }, []);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyKeys.current.size > 0 && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyKeys.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{ set }}>
      {children}
      {blocker.state === 'blocked' ? (
        <ConfirmDialog
          title="Sair sem salvar?"
          message="Você tem alterações que ainda não foram salvas. Deseja realmente sair desta tela?"
          cancelLabel="Continuar editando"
          confirmLabel="Sair sem salvar"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Marca esta tela como "com alterações" enquanto `dirty` for verdadeiro. Depois de salvar com sucesso, chame
 * `markClean()` ANTES de navegar, para a saída não perguntar.
 */
export function useUnsavedChanges(key: string, dirty: boolean): { markClean: () => void } {
  const registry = useContext(UnsavedChangesContext);
  if (!registry) throw new Error('useUnsavedChanges precisa estar dentro de <UnsavedChangesProvider>.');
  const { set } = registry;

  useEffect(() => {
    set(key, dirty);
    return () => set(key, false);
  }, [key, dirty, set]);

  return { markClean: () => set(key, false) };
}
