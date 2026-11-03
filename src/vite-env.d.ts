/// <reference types="vite/client" />

interface Window {
  CARE_API_URL: string;
  __CARE_PLUGIN_RUNTIME__?: {
    meta: Record<string, { config?: Record<string, unknown> }>;
  };
}
