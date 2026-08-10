import ProductMappings from "./pages/ProductMappings";

const routes = {
  "/facility/:facilityId/dvdms/product-mappings": ({
    facilityId,
  }: {
    facilityId: string;
  }) => <ProductMappings facilityId={facilityId} />,
};

export default routes;
