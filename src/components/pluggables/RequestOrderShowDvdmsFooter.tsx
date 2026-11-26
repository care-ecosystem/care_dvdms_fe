import { ComponentType, FC, MouseEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { ArrowRight, BadgeCheck, Send } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import {
  I18N_NAMESPACE,
  LIST_FETCH_LIMIT,
  REQUEST_ORDER_STATUS_POLL_INTERVAL_MS,
} from "@/lib/constants";
import { dvdmsRecordPath } from "@/lib/paths";
import { DeliveryOrderStatus } from "@/types/deliveryOrder";
import { isOutwardWithDvdms, RecordOrder } from "@/types/recordOrder";
import { Button } from "@/components/ui/button";
// import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import useDvdmsLocation from "@/hooks/useDvdmsLocation";
import useDvdmsPermissions from "@/hooks/useDvdmsPermissions";
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
  instituteId?: string;
  recordOrder?: RecordOrder;
  recordOrdersLoaded: boolean;
};

/**
 * Override for the core `RequestOrderShow` page.
 *
 * Renders the core page untouched and floats a compact action bar over it —
 * the same shape core uses for the "invoice created / back to appointment"
 * alert — active for a DVDMS order (mapped store and supplier, or an existing
 * record order). Decided from data, not the URL: core's edit page drops query
 * params.
 *
 * The bar creates the record order straight from this order — skipping the
 * DVDMS link order form, since the supplier and store are taken from the
 * configured mappings — and lands on its drug mapping page. Once a record
 * order exists, it turns into a confirmation that links to it.
 */
const RequestOrderShowDvdmsFooter: FC<Props> = ({ __base: Base, ...props }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const { facilityId, locationId, requestOrderId } = props;

  // Without `canUse` the DVDMS lookups would only be denied, so they are
  // skipped and the page is left to core.
  const {
    canUse,
    canManage,
    isLoading: isPermissionsLoading,
    isError: isPermissionsError,
  } = useDvdmsPermissions(facilityId);

  // Core's query key, shared with the core page.
  const {
    data: requestOrder,
    isLoading: isOrderLoading,
    isError: isOrderError,
  } = useQuery({
    queryKey: ["requestOrders", requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
  });

  const {
    institute,
    locationId: storeLocationId,
    isLoading: isLocationLoading,
    isError: isStoresError,
  } = useDvdmsLocation(facilityId, locationId, canUse);

  const {
    data: supplierMappings,
    isLoading: isSuppliersLoading,
    isError: isSuppliersError,
  } = useQuery({
    queryKey: ["dvdms_supplier_mappings", institute?.id],
    queryFn: () => apis.supplierMappings.list(institute!.id),
    enabled: canUse && !!institute?.id,
  });

  const {
    data: recordOrdersData,
    isLoading: isRecordOrdersLoading,
    isError: isRecordOrdersError,
  } = useQuery({
    queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
        ordering: "-created_date",
      }),
    enabled: canUse && !!institute?.id,
  });

  // The core route carries no recordOrderId, so reflect the latest record order.
  const recordOrder = recordOrdersData?.results?.[0];

  const supplierId = requestOrder?.supplier?.id;
  const isMappedOrder =
    storeLocationId === locationId &&
    !!supplierId &&
    !!supplierMappings?.results.some(
      (item) => item.supplier?.id === supplierId,
    );

  const isDvdmsOrder = canUse && (!!recordOrder || isMappedOrder);
  const showBar = canManage && isDvdmsOrder;

  // Until the lookups settle, or if one fails, the order may still be a DVDMS
  // one: keep delivery creation blocked rather than let one through.
  const isUnverified =
    isOrderLoading ||
    isLocationLoading ||
    isSuppliersLoading ||
    isRecordOrdersLoading ||
    isOrderError ||
    isStoresError ||
    isSuppliersError ||
    isRecordOrdersError;

  // Only users who can manage DVDMS are held to its flow; until permissions are
  // known, block rather than let one through.
  const blockDelivery =
    isPermissionsLoading ||
    isPermissionsError ||
    (canManage && (isDvdmsOrder || isUnverified));

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
        style={showBar ? { paddingBottom: "7rem" } : undefined}
        onClickCapture={blockDelivery ? blockCoreDeliveryCreation : undefined}
      >
        <Base {...props} />
      </div>
      {/* The bar brings its own shortcut context: it renders inside core's
          tree, which carries no plugin ShortcutProvider. */}
      {showBar && (
        <ShortcutProvider>
          <DvdmsFooterBar
            facilityId={facilityId}
            locationId={locationId}
            requestOrderId={requestOrderId}
            instituteId={institute?.id}
            recordOrder={recordOrder}
            recordOrdersLoaded={!!recordOrdersData}
          />
        </ShortcutProvider>
      )}
    </>
  );
};

const DvdmsFooterBar: FC<BarProps> = ({
  facilityId,
  locationId,
  requestOrderId,
  instituteId,
  recordOrder,
  recordOrdersLoaded,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const queryClient = useQueryClient();
  useShortcutSubContext("facility:inventory");

  // Polled until submitted: core's invalidation after approval has not proved
  // reliable across the plugin boundary.
  const { data: requestOrder } = useQuery({
    queryKey: ["requestOrders", requestOrderId],
    queryFn: () => apis.requestOrders.retrieve(facilityId, requestOrderId),
    refetchInterval: (query) =>
      query.state.data?.status === "pending"
        ? false
        : REQUEST_ORDER_STATUS_POLL_INTERVAL_MS,
  });

  /**
   * The push to DVDMS, once the record order has one. A record order still in
   * draft or pending has nothing on the DVDMS side yet.
   */
  const { data: outwardData } = useQuery({
    queryKey: ["dvdms_record_order_outward", instituteId, recordOrder?.id],
    queryFn: () =>
      apis.recordOrderOutward.list(instituteId!, recordOrder!.id, {
        limit: 1,
        ordering: "-created_date",
      }),
    enabled: !!instituteId && !!recordOrder?.id,
  });

  /**
   * A record order still in draft or pending, or one whose push failed, leaves core's own actions alone.
   */
  const isSentToDvdms = isOutwardWithDvdms(outwardData?.results?.[0]?.status);

  /**
   * The deliveries raised against this order.
   */
  const isRequester = requestOrder?.destination?.id === locationId;

  const deliveryOrdersQueryParams = {
    request_order: requestOrderId,
    ...(isRequester && {
      status: "pending,in_progress,completed",
    }),
  };

  const { data: deliveryOrdersData } = useQuery({
    queryKey: ["deliveryOrders", deliveryOrdersQueryParams],
    queryFn: () =>
      apis.supplyDeliveries.listDeliveryOrders(deliveryOrdersQueryParams),
    enabled: isSentToDvdms,
  });

  /**
   * Once a delivery has actually been completed the order has been supplied, Until then action is blocked.
   */
  const hasCompletedDelivery = !!deliveryOrdersData?.results?.some(
    (deliveryOrder) => deliveryOrder.status === DeliveryOrderStatus.completed,
  );

  /**
   * Blocks core's "mark as draft / completed / entered in error / abandoned" , if order is sent to dvdms & allows if delivery is completed
   */
  useEffect(() => {
    if (!isSentToDvdms) return;

    const blockedActions = [
      { iconClass: "care-l-pause", message: "order_sent_to_dvdms_locked" }, // mark as draft
      // Mark as completed is its own message: it is not locked outright, it is
      // waiting on the DVDMS issues being acknowledged into a delivery.
      ...(hasCompletedDelivery
        ? []
        : [
            {
              iconClass: "care-l-play",
              message: "order_sent_to_dvdms_acknowledge_to_complete",
            },
          ]),
      {
        iconClass: "care-l-exclamation-circle", // mark as entered in error
        message: "order_sent_to_dvdms_locked",
      },
      { iconClass: "care-l-ban", message: "order_sent_to_dvdms_locked" }, // mark as abandoned
    ];

    const blockStatusChange = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const menuItem = target?.closest?.('[role="menuitem"]');
      if (!menuItem) return;
      const blockedAction = blockedActions.find(({ iconClass }) =>
        menuItem.querySelector(`.${iconClass}`),
      );
      if (!blockedAction) return;

      event.preventDefault();
      event.stopPropagation();
      toast.error(t(blockedAction.message));
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    };

    document.addEventListener("click", blockStatusChange, true);
    return () => document.removeEventListener("click", blockStatusChange, true);
  }, [isSentToDvdms, hasCompletedDelivery, t]);

  // Core has no "approved" state for a request order: `pending` is the
  // submitted order, which is what DVDMS accepts. A draft has to be submitted
  // first — the same rule the DVDMS link order form applies.
  const isSubmitted = requestOrder?.status === "pending";

  // Same mapping rules as the DVDMS link order form's submit.
  const { mutate: createRecordOrder, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const [suppliers, stores] = await Promise.all([
        apis.supplierMappings.list(instituteId!),
        apis.dvdmsInstituteStores.list(facilityId, instituteId!, {
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
      return apis.recordOrders.create(instituteId!, {
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
        queryKey: ["dvdms_record_order_status", instituteId, requestOrderId],
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
    (isSubmitted && !!instituteId && recordOrdersLoaded && !isCreating);

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
