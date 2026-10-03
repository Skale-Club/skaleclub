import { OrderFormPage } from "@/components/OrderFormPage";

export default function PlaqueOrderForm() {
  return (
    <OrderFormPage
      formSlug="nfc-plaque-order"
      badge="Plaque order"
      documentTitle="Complete your NFC plaque order | Skale Club"
      backHref="/products/nfc-review-plaque"
      backLabel="See the plaque page"
      backLabelShort="Plaque"
    />
  );
}
