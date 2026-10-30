import {
  DEFAULT_DELIVERY_ORDER_NAME,
  DEFAULT_DELIVERY_ORDER_NOTE,
  DEFAULT_RECORD_ORDER_NAME,
  PLUGIN_SLUG,
} from "@/lib/constants";

const configString = (key: string, fallback: string) => {
  const value =
    window.__CARE_PLUGIN_RUNTIME__?.meta?.[PLUGIN_SLUG]?.config?.[key];
  return typeof value === "string" ? value : fallback;
};

const configTitle = (key: string, fallback: string, name: string) =>
  configString(key, fallback)
    .replace(/\{order_name\}/g, () => name)
    .trim() || name;

export const getRecordOrderName = (name: string) =>
  configTitle("recordOrderName", DEFAULT_RECORD_ORDER_NAME, name);

export const getDeliveryOrderName = (name: string) =>
  configTitle("deliveryOrderName", DEFAULT_DELIVERY_ORDER_NAME, name);

export const getDeliveryOrderNote = () =>
  configString("deliveryOrderNote", DEFAULT_DELIVERY_ORDER_NOTE);
