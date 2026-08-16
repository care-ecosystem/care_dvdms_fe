import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import shortcutsConfig from "@/config/keyboardShortcuts.json";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  formatKeyboardShortcut,
  shortcutActionHandler,
} from "@/lib/keyboardShortcutUtils";
import { expandShortcutContext } from "@/lib/shortcutUtils";

interface ShortcutContextType {
  subContext?: string;
  setSubContext: (subContext?: string) => void;
  ignoreInputFields: boolean;
  setIgnoreInputFields: (ignore: boolean) => void;
  getShortcutDisplay: (actionId: string) => string | undefined;
}

const ShortcutContext = createContext<ShortcutContextType | null>(null);

type ShortcutProviderProps = {
  children: ReactNode;
  ignoreInputFields?: boolean;
};

export const ShortcutProvider: FC<ShortcutProviderProps> = ({
  children,
  ignoreInputFields: defaultIgnoreInputFields = false,
}) => {
  const [subContext, setSubContext] = useState<string | undefined>();
  const [ignoreInputFields, setIgnoreInputFields] = useState(
    defaultIgnoreInputFields,
  );

  const contexts = useMemo(
    () => ["global", ...expandShortcutContext(subContext || "")],
    [subContext],
  );

  const handlers = useMemo(() => {
    const config = shortcutsConfig as Record<
      string,
      { action: string }[]
    >;
    const handlersMap: Record<string, () => void> = {};

    contexts.forEach((context) => {
      const contextActions = config[context];
      if (!contextActions) return;
      contextActions.forEach((action) => {
        handlersMap[action.action] = shortcutActionHandler(action.action);
      });
    });

    return handlersMap;
  }, [contexts]);

  const getShortcutDisplay = useMemo(() => {
    return (actionId: string): string | undefined => {
      const config = shortcutsConfig as Record<
        string,
        { action: string; key: string }[]
      >;

      for (const context of contexts) {
        const contextActions = config[context];
        if (!contextActions) continue;

        const shortcut = contextActions.find((s) => s.action === actionId);
        if (shortcut) {
          return formatKeyboardShortcut(shortcut.key);
        }
      }

      return undefined;
    };
  }, [contexts]);

  useKeyboardShortcuts(
    contexts,
    {},
    handlers,
    subContext,
    ignoreInputFields,
  );

  const value = useMemo(
    () => ({
      subContext,
      setSubContext,
      ignoreInputFields,
      setIgnoreInputFields,
      getShortcutDisplay,
    }),
    [subContext, ignoreInputFields, getShortcutDisplay],
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
};

export function useShortcuts() {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error("useShortcuts must be used within a ShortcutProvider");
  }
  return context;
}

export function useShortcutDisplay() {
  const { getShortcutDisplay } = useShortcuts();
  return getShortcutDisplay;
}

export function useShortcutSubContext(
  subContext?: string,
  options?: { ignoreInputFields?: boolean },
) {
  const shortcuts = useShortcuts();

  useEffect(() => {
    if (subContext) {
      shortcuts.setSubContext(subContext);
      return () => shortcuts.setSubContext(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subContext]);

  useEffect(() => {
    if (options?.ignoreInputFields !== undefined) {
      shortcuts.setIgnoreInputFields(options.ignoreInputFields);
      return () => shortcuts.setIgnoreInputFields(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.ignoreInputFields]);

  return shortcuts;
}
