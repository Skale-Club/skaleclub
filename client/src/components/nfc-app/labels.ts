import type { SmartTagDestinationType, SmartTagProductType } from '@shared/smartTags';

export const DESTINATION_LABELS_PT: Record<SmartTagDestinationType, string> = {
  google_review: 'Avaliação do Google',
  website: 'Site',
  booking: 'Agendamento',
  vcard: 'Cartão de contato',
  menu: 'Cardápio',
  social: 'Rede social',
  custom: 'Outro',
};

export const PRODUCT_LABELS_PT: Record<SmartTagProductType, string> = {
  google_review_sign: 'Placa de avaliação Google',
  business_card: 'Cartão NFC',
  keychain: 'Chaveiro NFC',
  safety_tag: 'Tag de segurança',
  menu_tag: 'Tag de cardápio',
  booking_tag: 'Tag de agendamento',
  custom: 'Personalizado',
};

export function tagStatusPill(status: string): { text: string; tone: 'green' | 'amber' | 'red' | 'slate' | 'blue' } {
  switch (status) {
    case 'active':
      return { text: 'Ativa', tone: 'green' };
    case 'disabled':
      return { text: 'Desativada', tone: 'red' };
    case 'assigned':
      return { text: 'Sem link', tone: 'amber' };
    case 'inventory':
      return { text: 'Em estoque', tone: 'slate' };
    case 'retired':
      return { text: 'Aposentada', tone: 'slate' };
    default:
      return { text: status, tone: 'slate' };
  }
}

export function chipStatusPill(nfcStatus: string): { text: string; tone: 'green' | 'amber' | 'red' | 'slate' | 'blue' } {
  switch (nfcStatus) {
    case 'verified':
      return { text: 'Chip conferido', tone: 'green' };
    case 'programmed':
      return { text: 'Chip gravado', tone: 'blue' };
    case 'failed':
      return { text: 'Falha na gravação', tone: 'red' };
    case 'locked':
      return { text: 'Chip travado', tone: 'slate' };
    default:
      return { text: 'Chip não gravado', tone: 'amber' };
  }
}
