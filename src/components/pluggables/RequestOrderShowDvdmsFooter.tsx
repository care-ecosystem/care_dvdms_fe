import { ComponentType, FC, MouseEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate, useQueryParams } from "raviger";
import { ArrowRight, BadgeCheck, Send } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import {
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
  REQUEST_ORDER_STATUS_POLL_INTERVAL_MS,
} from "@/lib/constants";
import { dvdmsRecordPath } from "@/lib/paths";
import { isOutwardWithDvdms } from "@/types/recordOrder";
import { Button } from "@/components/ui/button";
// import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { RequestOrder } from "@/types/requestOrder";
import { getRecordOrderName } from "@/utils/pluginConfig";

type RequestOrderShowProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  internal: boolean;
};

type Props = RequestOrderShowProps & {
  /** Injected by the core override registry — the component being replaced. */
  __base: ComponentType<RequestOrderShowProps>;
};

type BarProps = {
  facilityId: string;
  locationId: string;
  requestOrderId: string;
  /** The core order — DVDMS only accepts a submitted one. */
  requestOrder?: RequestOrder;
};

/**
 * Override for the core `RequestOrderShow` page.
 *
 * Renders the core page untouched and floats a compact action bar over it —
 * the same shape core uses for the "invoice created / back to appointment"
 * alert — active only on `?flow=dvdms`.
 *
 * The bar creates the record order straight from this order — skipping the
 * DVDMS link order form, since the supplier and store are taken from the
 * configured mappings — and lands on its drug mapping page. Once a record
 * order exists, it turns into a confirmation that links to it.
 */
const RequestOrderShowDvdmsFooter: FC<Props> = ({ __base: Base, ...props }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [{ flow }] = useQueryParams<{ flow?: string }>();
  const { facilityId, locationId, requestOrderId } = props;

  const isDvdmsFlow = flow === "dvdms";

  // Core's query key, deliberately: the core page invalidates
  // ["requestOrders", requestOrderId] when the order's status changes.
  //
  // The approval itself happens in core's own components, and that
  // invalidation has not proved reliable across the plugin boundary, so the
  // order is also polled until it is submitted — the button then unlocks a few
  // seconds after approval instead of waiting for a page refresh. Polling
  // stops as soon as the order is out of draft.
  const { data: requestOrder } = useQuery({
    queryKey: ["requestOrders", requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
    enabled: isDvdmsFlow,
    refetchInterval: (query) =>
      query.state.data?.status === "pending"
        ? false
        : REQUEST_ORDER_STATUS_POLL_INTERVAL_MS,
  });

  if (!isDvdmsFlow) {
    return <Base {...props} />;
  }

  /**
   * Blocks core's "Create Delivery Order" action while the order is being
   * supplied through DVDMS: a delivery raised here would not be tied to a
   * DVDMS issue, so the received quantities could never be reconciled.
   *
   * Core renders that action inline in `RequestOrderShow`, and only whole
   * registered components can be overridden, so it is intercepted by its link
   * instead — /inventory/external/deliveries/<tab>/new?supplyOrder=<id>.
   * Capture phase, so core's own handler never runs; this also covers core's
   * keyboard shortcut, which triggers the same link with a real click.
   */
  const blockCoreDeliveryCreation = (event: MouseEvent<HTMLDivElement>) => {
    const deliveryLink = (event.target as HTMLElement).closest?.(
      'a[href*="/deliveries/"][href*="supplyOrder="]',
    );
    if (!deliveryLink) return;

    event.preventDefault();
    event.stopPropagation();
    toast.error(t("use_dvdms_flow"));
  };

  return (
    <>
      {/* Inline padding, not a utility class: the core page is outside the
          plugin's Tailwind scope, so plugin utilities would not resolve here. */}
      <div
        style={{ paddingBottom: "7rem" }}
        onClickCapture={blockCoreDeliveryCreation}
      >
        <Base {...props} />
      </div>
      {/* The bar brings its own shortcut context: it renders inside core's
          tree, which carries no plugin ShortcutProvider. */}
      <ShortcutProvider>
        <DvdmsFooterBar
          facilityId={facilityId}
          locationId={locationId}
          requestOrderId={requestOrderId}
          requestOrder={requestOrder}
        />
      </ShortcutProvider>
    </>
  );
};

const DvdmsFooterBar: FC<BarProps> = ({
  facilityId,
  locationId,
  requestOrderId,
  requestOrder,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();
  useShortcutSubContext("facility:inventory");

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const { data: recordOrdersData } = useQuery({
    queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
        ordering: "-created_date",
      }),
    enabled: !!institute?.id,
  });

  // The core route carries no recordOrderId, so reflect the latest record order.
  const recordOrder = recordOrdersData?.results?.[0];

  /**
   * The push to DVDMS, once the record order has one. A record order still in
   * draft or pending has nothing on the DVDMS side yet.
   */
  const { data: outwardData } = useQuery({
    queryKey: ["dvdms_record_order_outward", institute?.id, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(institute!.id, recordOrder!.id, {
        limit: 1,
        ordering: "-created_date",
      }),
    enabled: !!institute?.id && !!recordOrder?.id,
  });

  /**
   * A record order still in draft or pending, or one whose push failed or was
   * cancelled, leaves core's own actions alone.
   */
  const isSentToDvdms = isOutwardWithDvdms(outwardData?.results?.[0]?.status);

  /**
   * Blocks core's "mark as draft / entered in error / abandoned" actions once
   * the order is with DVDMS.
   */
  useEffect(() => {
    if (!isSentToDvdms) return;

    const blockedIconClasses = [
      "care-l-pause", // mark as draft
      "care-l-exclamation-circle", // mark as entered in error
      "care-l-ban", // mark as abandoned
    ];

    const blockStatusChange = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const menuItem = target?.closest?.('[role="menuitem"]');
      if (!menuItem) return;
      if (
        !blockedIconClasses.some((iconClass) =>
          menuItem.querySelector(`.${iconClass}`),
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      toast.error(t("order_sent_to_dvdms_locked"));
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    };

    document.addEventListener("click", blockStatusChange, true);
    return () => document.removeEventListener("click", blockStatusChange, true);
  }, [isSentToDvdms, t]);

  // Core has no "approved" state for a request order: `pending` is the
  // submitted order, which is what DVDMS accepts. A draft has to be submitted
  // first — the same rule the DVDMS link order form applies.
  const isSubmitted = requestOrder?.status === "pending";

  // Same mapping rules as the DVDMS link order form's submit.
  const { mutate: createRecordOrder, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const [suppliers, stores] = await Promise.all([
        apis.supplierMappings.list(institute!.id),
        apis.dvdmsInstituteStores.list(facilityId, institute!.id, {
          limit: LIST_FETCH_LIMIT,
        }),
      ]);
      const supplierMapping = requestOrder!.supplier
        ? suppliers.results.find(
            (item) => item.supplier?.id === requestOrder!.supplier!.id,
          )
        : undefined;
      if (!supplierMapping) {
        throw new Error(
          "No DVDMS supplier mapping configured for this supplier.",
        );
      }
      const storeMapping = stores.results.find(
        (item) => item.store.id === locationId,
      );
      if (!storeMapping) {
        throw new Error("No DVDMS store mapping configured for this location.");
      }
      return apis.recordOrders.create(institute!.id, {
        name: getRecordOrderName(requestOrder!.name),
        order: requestOrderId,
        institute_store: storeMapping.id,
        institute_supplier: supplierMapping.id,
        status: "draft",
      });
    },
    onSuccess: (createdRecordOrder) => {
      toast.success(t("record_order_created_successfully"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_orders"] });
      queryClient.invalidateQueries({
        queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
      });
      navigate(
        dvdmsRecordPath(
          facilityId,
          locationId,
          requestOrderId,
          createdRecordOrder.id,
        ),
      );
    },
    onError: () => toast.error(t("failed_to_create_record_order")),
  });

  const canSend =
    !!recordOrder ||
    (isSubmitted && !!institute && !!recordOrdersData && !isCreating);

  const handleClick = () =>
    recordOrder
      ? navigate(
          dvdmsRecordPath(
            facilityId,
            locationId,
            requestOrderId,
            recordOrder.id,
          ),
        )
      : createRecordOrder();

  return (
    <div className="care-dvdms-container">
      {/* Inline max-width, not max-w-xl: the plugin's scoped Tailwind theme
          does not define the --container-* variables that utility resolves
          to, so the bar would stretch the full viewport width. */}
      <div
        className="fixed bottom-6 inset-x-4 z-50 mx-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        style={{ maxWidth: "36rem" }}
      >
        <div className="flex items-center justify-between gap-0">
          <div
            className={`flex flex-1 items-center gap-2 rounded-l-lg border p-4 ${
              recordOrder
                ? "border-green-200 bg-green-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            {recordOrder ? (
              <BadgeCheck className="size-5 shrink-0 text-green-600" />
            ) : (
              <Send className="size-5 shrink-0 text-primary-700" />
            )}
            <span
              className={`font-semibold ${
                recordOrder ? "text-green-900" : "text-gray-900"
              }`}
            >
              {recordOrder
                ? t("order_sent_to_dvdms")
                : isSubmitted
                  ? t("confirm_and_send_to_dvdms")
                  : t("approve_order_before_sending")}
            </span>
          </div>
          <div className="flex items-center rounded-r-lg bg-white p-2 pl-0">
            <Button
              type="button"
              variant="primary"
              className="ml-2 shadow"
              onClick={handleClick}
              disabled={!canSend}
            >
              {recordOrder ? (
                <ArrowRight className="mr-2 size-4" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              {recordOrder
                ? t("view_in_dvdms")
                : isCreating
                  ? t("creating")
                  : t("send_order_to_dvdms")}
              {/* <ShortcutBadge
                actionId="link-order-eaushadhi"
                variant="primary"
              /> */}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestOrderShowDvdmsFooter;
