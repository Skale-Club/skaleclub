export interface VCardContact {
  firstName: string;
  lastName: string;
  organization?: string | null;
  title?: string | null;
  workPhone?: string | null;
  cellPhone?: string | null;
  email?: string | null;
  url?: string | null;
  note?: string | null;
}

function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function generateVCard(contact: VCardContact): string {
  const firstName = escapeVCardValue(contact.firstName);
  const lastName = escapeVCardValue(contact.lastName);
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${firstName} ${lastName}`,
  ];

  if (contact.organization) vcf.push(`ORG:${escapeVCardValue(contact.organization)}`);
  if (contact.title) vcf.push(`TITLE:${escapeVCardValue(contact.title)}`);
  if (contact.workPhone) vcf.push(`TEL;TYPE=WORK,VOICE:${escapeVCardValue(contact.workPhone)}`);
  if (contact.cellPhone) vcf.push(`TEL;TYPE=CELL,VOICE:${escapeVCardValue(contact.cellPhone)}`);
  if (contact.email) vcf.push(`EMAIL;TYPE=PREF,INTERNET:${escapeVCardValue(contact.email)}`);
  if (contact.url) vcf.push(`URL:${escapeVCardValue(contact.url)}`);
  if (contact.note) vcf.push(`NOTE:${escapeVCardValue(contact.note)}`);

  vcf.push('END:VCARD');
  
  return vcf.join('\r\n');
}

export function downloadVCard(contact: VCardContact, filename: string = 'contact.vcf') {
  const vcfStr = generateVCard(contact);
  const blob = new Blob([vcfStr], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
