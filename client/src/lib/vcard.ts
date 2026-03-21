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

export function generateVCard(contact: VCardContact): string {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${contact.lastName};${contact.firstName};;;`,
    `FN:${contact.firstName} ${contact.lastName}`,
  ];

  if (contact.organization) vcf.push(`ORG:${contact.organization}`);
  if (contact.title) vcf.push(`TITLE:${contact.title}`);
  if (contact.workPhone) vcf.push(`TEL;TYPE=WORK,VOICE:${contact.workPhone}`);
  if (contact.cellPhone) vcf.push(`TEL;TYPE=CELL,VOICE:${contact.cellPhone}`);
  if (contact.email) vcf.push(`EMAIL;TYPE=PREF,INTERNET:${contact.email}`);
  if (contact.url) vcf.push(`URL:${contact.url}`);
  if (contact.note) vcf.push(`NOTE:${contact.note}`);

  vcf.push('END:VCARD');
  
  return vcf.join('\n');
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
