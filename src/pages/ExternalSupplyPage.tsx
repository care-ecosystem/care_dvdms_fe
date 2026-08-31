import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries, useQuery } from "@tanstack/react-query";
import { navigate } from "raviger";
import { Link2Icon } from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import RequestOrderTable from "@/components/RequestOrderTable";
import SupplierSelect from "@/components/SupplierSelect";
import { Pagination } from "@/components/ui/pagination";
import {
  ShortcutProvider,
  useShortcutSubContext,
} from "@/context/ShortcutContext";
import { Organization } from "@/types/organization";

const PAGE_SIZE = 10;

type TabValue = "draft" | "tracking";

const TABS_CONFIG: { value: TabValue; label: string; status?: string }[] = [
  { value: "draft", label: "draft", status: "draft" },
  { value: "tracking", label: "order_tracking" },
];

const EMPTY_MESSAGE_KEYS: Record<TabValue, string> = {
  draft: "no_draft_orders",
  tracking: "no_tracking_orders",
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
  const [currentTab, setCurrentTab] = useState<TabValue>("draft");
  const [supplierFilter, setSupplierFilter] = useState<Organization>();
  const [page, setPage] = useState(1);

  const handleTabChange = (value: TabValue) => {
    setCurrentTab(value);
    setPage(1);
  };

  const handleSupplierFilterChange = (supplier?: Organization) => {
    setSupplierFilter(supplier);
    setPage(1);
  };

  const { data: facility } = useQuery({
    queryKey: ["facility", facilityId],
    queryFn: () => apis.facilities.get(facilityId),
  });

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
  });

  const currentStatus = TABS_CONFIG.find(
    (tab) => tab.value === currentTab,
  )!.status;

  const { data, isLoading } = useQuery({
    queryKey: [
      "dvdms_record_orders",
      institute?.id,
      locationId,
      currentTab,
      page,
    ],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        ...(currentStatus ? { status: currentStatus } : {}),
        ordering: "-created_date",
      }),
    enabled: !!institute?.id,
  });

  const orders = (data?.results ?? []).filter(
    (order) =>
      (currentTab !== "tracking" || order.status !== "draft") &&
      (!supplierFilter ||
        order.institute_supplier?.supplier?.id === supplierFilter.id),
  );

  const approvedOrders = orders.filter((order) => order.status === "approved");

  const outwardQueries = useQueries({
    queries: approvedOrders.map((order) => ({
      queryKey: ["dvdms_record_order_outward", institute?.id, order.id],
      queryFn: () =>
        apis.recordOrderOutward.list(institute!.id, order.id, { limit: 1 }),
      enabled: !!institute?.id,
    })),
  });

  const outwardStatusByOrderId: Record<string, string> = {};
  approvedOrders.forEach((order, index) => {
    const status = outwardQueries[index]?.data?.results?.[0]?.status;
    if (status) outwardStatusByOrderId[order.id] = status;
  });

  const renderFilters = () => (
    <div className="flex flex-col md:flex-row gap-4">
      <SupplierSelect
        value={supplierFilter}
        onChange={handleSupplierFilterChange}
      />
    </div>
  );

  return (
    <div className="md:px-6 py-0 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("dvdms_external_supply")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("manage_external_supply_for")}{" "}
            <strong>{facility?.name ?? facilityId}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() =>
              navigate(
                `/facility/${facilityId}/locations/${locationId}/inventory/external/dvdms/new`,
              )
            }
          >
            <Link2Icon />
            {t("send_order_to_eaushadhi")}
            <ShortcutBadge actionId="link-order-eaushadhi" />
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
              isLoading={isLoading}
              emptyMessage={t(EMPTY_MESSAGE_KEYS[tab.value])}
              showIndentNo={tab.value === "tracking"}
              outwardStatusByOrderId={outwardStatusByOrderId}
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
