import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { PlusIcon, SearchIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { apis } from "@/apis";
import { HttpMethod, PaginatedResponse } from "@/apis/types";
import { I18N_NAMESPACE } from "@/lib/constants";
import { careExternalOrderPath, dvdmsBasePath } from "@/lib/paths";
import DvdmsNotConfigured from "@/components/DvdmsNotConfigured";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import RequestOrderTable from "@/components/RequestOrderTable";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import MultiFilter from "@/components/ui/multi-filter/MultiFilter";
import {
  createdByFilter,
  dateFilter,
  optionsFilter,
} from "@/components/ui/multi-filter/filterConfigs";
import useMultiFilterState from "@/components/ui/multi-filter/utils/useMultiFilterState";
import {
  FilterDateRange,
  FilterUser,
  longDateRangeOptions,
} from "@/components/ui/multi-filter/utils/Utils";
import { Pagination } from "@/components/ui/pagination";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { hasDvdmsIndent, RecordOrderOutward } from "@/types/recordOrder";
import {
  buildDvdmsRequestOrder,
  REQUEST_ORDER_PRIORITY_VARIANTS,
  REQUEST_ORDER_STATUS_VARIANTS,
} from "@/types/requestOrder";
import useDvdmsLocation from "@/hooks/useDvdmsLocation";
import { useDebounce } from "@/hooks/useDebounce";
import { getRequestOrderTags } from "@/utils/pluginConfig";

const PAGE_SIZE = 14;

type TabValue = "unsent" | "sent" | "completed";

const TABS_CONFIG: { value: TabValue; label: string; statuses: string[] }[] = [
  {
    value: "sent",
    label: "sent_orders",
    statuses: ["submitted", "issue_in_process", "issued"],
  },
  {
    value: "unsent",
    label: "unsent_orders",
    statuses: ["draft", "failed", "cancelled"],
  },
  {
    value: "completed",
    label: "completed_orders",
    statuses: ["completed", "rejected"],
  },
];

const PRIORITIES = ["routine", "urgent", "asap", "stat"];

const EMPTY_MESSAGE_KEYS: Record<TabValue, string> = {
  unsent: "no_unsent_orders",
  sent: "no_sent_orders",
  completed: "no_completed_orders",
};

type Filters = {
  indentNo: string;
  priority: string;
  createdBy: string;
  createdAfter: string;
  createdBefore: string;
  status: string;
};

const NO_FILTERS: Filters = {
  indentNo: "",
  priority: "",
  createdBy: "",
  createdAfter: "",
  createdBefore: "",
  status: "",
};

const STATUS_VARIANTS: Record<string, string> = {
  ...REQUEST_ORDER_STATUS_VARIANTS,
  issue_in_process: "yellow",
  issued: "green",
};

const OrderFilterBar: FC<{
  facilityId: string;
  statuses: string[];
  onChange: (update: Partial<Filters>) => void;
}> = ({ facilityId, statuses, onChange }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const filters = [
    optionsFilter("status", t("status"), statuses, STATUS_VARIANTS, t),
    optionsFilter(
      "priority",
      t("priority"),
      PRIORITIES,
      REQUEST_ORDER_PRIORITY_VARIANTS,
      t,
    ),
    createdByFilter("created_by", t("created_by")),
    dateFilter("created_date", t("creation_date"), longDateRangeOptions),
  ];

  const onFilterUpdate = (query: Record<string, unknown>) => {
    const update: Partial<Filters> = {};
    if ("status" in query) update.status = (query.status as string) || "";
    if ("priority" in query) update.priority = (query.priority as string) || "";
    if ("created_by" in query) {
      update.createdBy = (query.created_by as FilterUser | null)?.id ?? "";
    }
    if ("created_date" in query) {
      const range = query.created_date as FilterDateRange | null | undefined;
      update.createdAfter = range?.from ? format(range.from, "yyyy-MM-dd") : "";
      update.createdBefore = range?.to ? format(range.to, "yyyy-MM-dd") : "";
    }
    onChange(update);
  };

  const state = useMultiFilterState(filters, onFilterUpdate);

  return (
    <div className="w-full min-w-0 sm:w-auto">
      <MultiFilter
        selectedFilters={state.selectedFilters}
        onFilterChange={state.handleFilterChange}
        onOperationChange={state.handleOperationChange}
        onClearAll={state.handleClearAll}
        onClearFilter={state.handleClearFilter}
        className="w-full min-w-0 items-start sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"
        triggerButtonClassName="self-start sm:self-center"
        clearAllButtonClassName="self-center"
        facilityId={facilityId}
      />
    </div>
  );
};

type ExternalSupplyPageProps = {
  facilityId: string;
  locationId: string;
};

const ExternalSupplyPage: FC<ExternalSupplyPageProps> = (props) => (
  <ShortcutProvider>
    <ExternalSupplyPageContent {...props} />
  </ShortcutProvider>
);

const ExternalSupplyPageContent: FC<ExternalSupplyPageProps> = ({
  facilityId,
  locationId,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  useShortcutSubContext("facility:inventory");
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<TabValue>("sent");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);

  const handleTabChange = (value: TabValue) => {
    setCurrentTab(value);
    setFilters(NO_FILTERS); // statuses differ per tab
    setPage(1);
  };

  const updateFilters = (update: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...update }));
    setPage(1);
  };

  const {
    institute,
    store,
    locationId: configuredLocationId,
    isLoading: isConfigLoading,
  } = useDvdmsLocation(facilityId, locationId);

  const { data: supplierMappingsResponse } = useQuery({
    queryKey: ["dvdms_supplier_mappings", institute?.id],
    queryFn: () => apis.supplierMappings.list(institute!.id),
    enabled: !!institute?.id,
  });

  const supplierMappings = supplierMappingsResponse?.results ?? [];
  const defaultMapping =
    supplierMappings.find((item) => item.is_default) ?? supplierMappings[0];

  const { mutate: createOrder, isPending: isCreatingOrder } = useMutation({
    mutationFn: async () => {
      const mapping = defaultMapping;
      if (!mapping?.supplier) {
        throw new Error("no_supplier_mapping");
      }
      const order = await apis.requestOrders.create(
        facilityId,
        buildDvdmsRequestOrder(mapping.supplier.id, locationId),
      );
      const tags = getRequestOrderTags();
      if (tags.length > 0) {
        // The order already exists; a tag failure must not report it as uncreated.
        await apis.requestOrders
          .setTags(facilityId, order.id, tags)
          .catch(() => toast.error(t("failed_to_update_tags")));
      }
      return order;
    },
    onSuccess: (order) => {
      toast.success(t("order_created_successfully"));
      queryClient.invalidateQueries({ queryKey: ["dvdms_record_orders"] });
      navigate(careExternalOrderPath(facilityId, locationId, order.id));
    },
    onError: (error) =>
      toast.error(
        error.message === "no_supplier_mapping"
          ? t("dvdms_supplier_not_configured")
          : t("failed_to_create_order"),
      ),
  });

  const currentTabConfig = TABS_CONFIG.find((tab) => tab.value === currentTab)!;

  const dateParams = {
    ...(filters.createdBy ? { created_by: filters.createdBy } : {}),
    ...(filters.createdAfter
      ? { created_date_after: filters.createdAfter }
      : {}),
    ...(filters.createdBefore
      ? { created_date_before: filters.createdBefore }
      : {}),
  };

  const indentNo = useDebounce(filters.indentNo, 300);

  const { data, isLoading } = useQuery({
    queryKey: [
      "dvdms_record_orders",
      institute?.id,
      currentTab,
      { ...filters, indentNo },
      page,
    ],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        tab: currentTab,
        location: locationId,
        ...(filters.status ? { status: filters.status } : {}),
        ordering: "-created_date",
        ...(indentNo ? { indent_no: indentNo } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...dateParams,
      }),
    enabled: !!institute?.id,
  });

  const orders = data?.results ?? [];

  const indentOrders = orders.filter((order) => hasDvdmsIndent(order.status));
  const indentOrderIds = indentOrders.map((order) => order.id);

  const { data: outwardBatchResponse, isPending: isOutwardBatchPending } =
    useQuery({
      queryKey: [
        "dvdms_record_order_outward_batch",
        institute?.id,
        indentOrderIds,
      ],
      queryFn: () =>
        apis.batchRequests.createChunked({
          requests: indentOrders.map((order) => ({
            url: apis.recordOrderOutward.path(institute!.id, order.id),
            method: HttpMethod.GET,
            body: { limit: 1 },
            reference_id: order.id,
          })),
        }),
      enabled: !!institute?.id && indentOrders.length > 0,
    });

  const outwardByOrderId: Record<string, RecordOrderOutward> = {};
  outwardBatchResponse?.results.forEach((result) => {
    const outward = (
      result.data as PaginatedResponse<RecordOrderOutward> | undefined
    )?.results?.[0];
    if (outward) outwardByOrderId[result.reference_id] = outward;
  });
  const isOutwardLoading = indentOrders.length > 0 && isOutwardBatchPending;

  const renderHeading = () => (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">
        {t("dvdms_external_supply")}
      </h1>
      {store && (
        <p className="text-sm text-gray-500">
          <strong>{store.store.name}</strong>
          {store.eaushadhi_store_name &&
            ` (${t("dvdms_store")}: ${store.eaushadhi_store_name})`}
        </p>
      )}
      {defaultMapping?.eaushadhi_warehouse_name && (
        <p className="text-sm text-gray-500">
          {t("dvdms_warehouse")}:{" "}
          <strong>{defaultMapping.eaushadhi_warehouse_name}</strong>
        </p>
      )}
    </div>
  );

  const renderFilters = () => (
    <div className="flex flex-wrap items-start gap-2 pb-2">
      {currentTab !== "unsent" && (
        <div className="relative w-full sm:w-auto">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-500" />
          <Input
            className="h-9 w-full pl-10 sm:w-64"
            placeholder={t("search_indent_no")}
            aria-label={t("eaushadhi_indent_no")}
            value={filters.indentNo}
            onChange={(e) => updateFilters({ indentNo: e.target.value })}
          />
        </div>
      )}
      <OrderFilterBar
        key={currentTab}
        facilityId={facilityId}
        statuses={currentTabConfig.statuses}
        onChange={updateFilters}
      />
    </div>
  );

  if (!isConfigLoading && !configuredLocationId) {
    return (
      <div className="md:px-6 py-0 space-y-4 min-w-0">
        {renderHeading()}
        <DvdmsNotConfigured hasInstitute={!!institute} />
      </div>
    );
  }

  return (
    <div className="md:px-6 py-0 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {renderHeading()}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate(`${dvdmsBasePath(facilityId, locationId)}/new`)
            }
          >
            <SendIcon />
            {t("send_order_to_dvdms")}
            <ShortcutBadge actionId="link-order-eaushadhi" />
          </Button>
          <Button
            variant="primary"
            onClick={() => createOrder()}
            disabled={isCreatingOrder}
          >
            <PlusIcon />
            {isCreatingOrder ? t("creating") : t("create_order")}
            <ShortcutBadge actionId="create-order" />
          </Button>
        </div>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(value) => handleTabChange(value as TabValue)}
      >
        <TabsList className="w-full justify-evenly sm:justify-start border-b rounded-none bg-transparent p-0 h-auto overflow-x-auto">
          {TABS_CONFIG.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="border-b-3 px-2.5 py-1 font-semibold text-gray-600 hover:text-gray-900 data-[state=active]:border-b-primary-700  data-[state=active]:text-primary-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none"
            >
              {t(tab.label)}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS_CONFIG.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="mt-2 space-y-4"
          >
            {renderFilters()}
            <RequestOrderTable
              facilityId={facilityId}
              locationId={locationId}
              orders={orders}
              isLoading={isLoading || isOutwardLoading}
              emptyMessage={t(EMPTY_MESSAGE_KEYS[tab.value])}
              showIndentNo={tab.value !== "unsent"}
              outwardByOrderId={outwardByOrderId}
              skeletonCount={PAGE_SIZE}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={data?.count ?? 0}
              onPageChange={setPage}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ExternalSupplyPage;
