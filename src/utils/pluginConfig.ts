import {
  DEFAULT_DELIVERY_ORDER_NAME,
  DEFAULT_DELIVERY_ORDER_NOTE,
  DEFAULT_RECORD_ORDER_NAME,
  PLUGIN_SLUG,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

const configValue = (key: string) =>
  window.__CARE_PLUGIN_RUNTIME__?.meta?.[PLUGIN_SLUG]?.config?.[key];

const configString = (key: string, fallback: string) => {
  const value = configValue(key);
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

const getRequestOrderName = () => {
  const date = formatDate(new Date().toISOString());
  const name = configString("requestOrderName", "").replace(/\{date\}/g, date);
  return name.trim() || `Send Order to DVDMS - ${date}`;
};

export const getRequestOrderDefaults = () => ({
  name: getRequestOrderName(),
  note: configString("requestOrderNote", ""),
  intent: configString("requestOrderIntent", "order"),
  category: configString("requestOrderCategory", "nonstock"),
  priority: configString("requestOrderPriority", "routine"),
  reason: configString("requestOrderReason", "ward_stock"),
});

// Tags can't be sent on create; they are applied with set_tags afterwards.
export const getRequestOrderTags = (): string[] => {
  const tags = configValue("requestOrderTags");
  return Array.isArray(tags)
    ? tags.filter((tag) => typeof tag === "string")
    : [];
};
