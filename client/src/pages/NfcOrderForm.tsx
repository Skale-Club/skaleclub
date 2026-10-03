import { OrderFormPage } from "@/components/OrderFormPage";

export default function NfcOrderForm() {
  return (
    <OrderFormPage
      formSlug="nfc-keychain-order"
      badge="NFC order"
      documentTitle="Complete your NFC keychain order | Skale Club"
      backHref="/nfc-guide"
      backLabel="Read the keychain guide"
      backLabelShort="Guide"
    />
  );
}
