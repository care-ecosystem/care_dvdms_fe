import { ComponentType, FC } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { navigate, useQueryParams } from "raviger";
import { ArrowRight, BadgeCheck, Send } from "lucide-react";

import { apis } from "@/apis";
import { I18N_NAMESPACE, LIST_FETCH_LIMIT } from "@/lib/constants";
import { dvdmsLinkOrderPath, dvdmsRecordPath } from "@/lib/paths";
import { Button } from "@/components/ui/button";

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

/**
 * Override for the core `RequestOrderShow` page.
 *
 * Renders the core page untouched and floats a compact action bar over it —
 * the same shape core uses for the "invoice created / back to appointment"
 * alert — active only on `?flow=dvdms`.
 *
 * The bar is a hand-off, not an action: it sends the user into the DVDMS link
 * order form with this order preselected, where the order is actually sent.
 * Once a record order exists, it turns into a confirmation that links to it.
 */
const RequestOrderShowDvdmsFooter: FC<Props> = ({ __base: Base, ...props }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [{ flow }] = useQueryParams<{ flow?: string }>();
  const { facilityId, locationId, requestOrderId } = props;

  const isDvdmsFlow = flow === "dvdms";

  const { data: institute } = useQuery({
    queryKey: ["dvdms_institute", facilityId],
    queryFn: () => apis.institutes.get(facilityId),
    enabled: isDvdmsFlow,
  });

  const { data: recordOrdersData } = useQuery({
    queryKey: ["dvdms_record_order_status", institute?.id, requestOrderId],
    queryFn: () =>
      apis.recordOrders.list(institute!.id, {
        order: requestOrderId,
        limit: LIST_FETCH_LIMIT,
        ordering: "-created_date",
      }),
    enabled: isDvdmsFlow && !!institute?.id,
  });

  // The core route carries no recordOrderId, so reflect the latest record order.
  const recordOrder = recordOrdersData?.results?.[0];

  if (!isDvdmsFlow) {
    return <Base {...props} />;
  }

  const handleClick = () =>
    navigate(
      recordOrder
        ? dvdmsRecordPath(facilityId, locationId, requestOrderId, recordOrder.id)
        : dvdmsLinkOrderPath(facilityId, locationId, requestOrderId),
    );

  return (
    <>
      {/* Inline padding, not a utility class: the core page is outside the
          plugin's Tailwind scope, so plugin utilities would not resolve here. */}
      <div style={{ paddingBottom: "7rem" }}>
        <Base {...props} />
      </div>
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
                  : t("confirm_and_send_to_dvdms")}
              </span>
            </div>
            <div className="flex items-center rounded-r-lg bg-white p-2 pl-0">
              <Button
                type="button"
                variant="primary"
                className="ml-2 shadow"
                onClick={handleClick}
              >
                {recordOrder ? (
                  <ArrowRight className="mr-2 size-4" />
                ) : (
                  <Send className="mr-2 size-4" />
                )}
                {recordOrder ? t("view_in_dvdms") : t("send_order_to_dvdms")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RequestOrderShowDvdmsFooter;
