const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

export interface GHLSlotItem {
  startTime: string;
  endTime: string;
}

export interface GHLFreeSlotsResponse {
  slots?: GHLSlotItem[];
  [date: string]: any;
}

export interface GHLContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  locationId: string;
}

export interface GHLAppointment {
  id: string;
  calendarId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  title: string;
  status: string;
}

export interface GHLCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
}

async function ghlFetch(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${GHL_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Version": GHL_API_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return response;
}

export async function testGHLConnection(apiKey: string, locationId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await ghlFetch(`/locations/${locationId}`, apiKey);

    if (response.ok) {
      return { success: true, message: "Connection successful" };
    } else {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.message || `Connection failed: ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Connection failed"
    };
  }
}

export async function getGHLCustomFields(
  apiKey: string,
  locationId: string
): Promise<{ success: boolean; customFields?: GHLCustomField[]; message?: string }> {
  try {
    const response = await ghlFetch(`/locations/${locationId}/customFields`, apiKey);

    if (response.ok) {
      const data = await response.json();
      // GHL returns { customFields: [...] }
      const fields = data.customFields || [];
      return {
        success: true,
        customFields: fields.map((f: any) => ({
          id: f.id,
          name: f.name,
          fieldKey: f.fieldKey,
          dataType: f.dataType,
        }))
      };
    } else {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.message || `Failed to get custom fields: ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to fetch custom fields"
    };
  }
}

export async function getGHLFreeSlots(
  apiKey: string,
  calendarId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = "America/New_York"
): Promise<{ success: boolean; slots?: GHLSlotItem[]; message?: string }> {
  try {
    const startTimestamp = Math.floor(startDate.getTime());
    const endTimestamp = Math.floor(endDate.getTime());
    
    const params = new URLSearchParams({
      startDate: startTimestamp.toString(),
      endDate: endTimestamp.toString(),
      timezone,
    });

    const response = await ghlFetch(
      `/calendars/${calendarId}/free-slots?${params.toString()}`,
      apiKey
    );

    if (response.ok) {
      const data = await response.json();
      console.log('GHL raw API response:', JSON.stringify(data, null, 2));
      
      let slotsArray: GHLSlotItem[] = [];
      
      if (Array.isArray(data)) {
        slotsArray = data;
      } else if (data.slots && Array.isArray(data.slots)) {
        slotsArray = data.slots;
      } else if (data._embedded && data._embedded.slots) {
        slotsArray = data._embedded.slots;
      } else {
        // GHL returns slots grouped by date like: { "2026-01-09": { slots: [...] }, "2026-01-10": { slots: [...] } }
        // We need to iterate ALL dates and accumulate all slots
        for (const key of Object.keys(data)) {
          if (key !== 'traceId' && data[key]?.slots && Array.isArray(data[key].slots)) {
            const dateSlots = data[key].slots.map((s: string) => ({
              startTime: s,
              endTime: s
            }));
            slotsArray = slotsArray.concat(dateSlots);
          }
        }
      }
      
      return { success: true, slots: slotsArray };
    } else {
      const error = await response.json().catch(() => ({}));
      return { 
        success: false, 
        message: error.message || `Failed to get slots: ${response.status}` 
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || "Failed to fetch free slots" 
    };
  }
}

export async function createGHLContact(
  apiKey: string,
  locationId: string,
  contact: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    customFields?: Array<{ id: string; field_value: string }>;
  }
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  try {
    const body: any = {
      locationId,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      address1: contact.address,
    };

    // Add custom fields if provided
    if (contact.customFields && contact.customFields.length > 0) {
      body.customFields = contact.customFields;
    }

    const response = await ghlFetch("/contacts/", apiKey, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, contactId: data.contact?.id };
    } else {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.message || `Failed to create contact: ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create contact"
    };
  }
}

export async function findGHLContactByEmail(
  apiKey: string,
  locationId: string,
  email: string
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  try {
    const params = new URLSearchParams({
      locationId,
      query: email,
    });

    const response = await ghlFetch(`/contacts/?${params.toString()}`, apiKey);

    if (response.ok) {
      const data = await response.json();
      const contact = data.contacts?.find((c: any) => c.email === email);
      return { success: true, contactId: contact?.id };
    } else {
      return { success: false };
    }
  } catch (error: any) {
    return { success: false };
  }
}

export async function findGHLContactByPhone(
  apiKey: string,
  locationId: string,
  phone: string
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const params = new URLSearchParams({
      locationId,
      query: normalizedPhone,
    });

    const response = await ghlFetch(`/contacts/?${params.toString()}`, apiKey);

    if (response.ok) {
      const data = await response.json();
      const contact = data.contacts?.find((c: any) => {
        const contactPhone = c.phone?.replace(/\D/g, '') || '';
        return contactPhone === normalizedPhone || contactPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(contactPhone);
      });
      return { success: true, contactId: contact?.id };
    } else {
      return { success: false };
    }
  } catch (error: any) {
    return { success: false };
  }
}

export async function createGHLAppointment(
  apiKey: string,
  calendarId: string,
  locationId: string,
  appointment: {
    contactId: string;
    startTime: string;
    endTime: string;
    title: string;
    address?: string;
  }
): Promise<{ success: boolean; appointmentId?: string; message?: string }> {
  try {
    const response = await ghlFetch("/calendars/events/appointments", apiKey, {
      method: "POST",
      body: JSON.stringify({
        calendarId,
        locationId,
        contactId: appointment.contactId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        title: appointment.title,
        address: appointment.address,
        appointmentStatus: "confirmed",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, appointmentId: data.id };
    } else {
      const error = await response.json().catch(() => ({}));
      return { 
        success: false, 
        message: error.message || `Failed to create appointment: ${response.status}` 
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || "Failed to create appointment" 
    };
  }
}

function parseAddress(fullAddress: string): { street: string; city: string; state: string } {
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    const stateMatch = lastPart.match(/^([A-Z]{2})$/i);
    
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      const city = parts[parts.length - 2];
      const street = parts.slice(0, parts.length - 2).join(', ');
      return { street, city, state };
    }
  }
  
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const cityStateMatch = lastPart.match(/^(.+?)\s+([A-Z]{2})$/i);
    
    if (cityStateMatch) {
      const city = cityStateMatch[1].trim();
      const state = cityStateMatch[2].toUpperCase();
      const street = parts.slice(0, parts.length - 1).join(', ');
      return { street, city, state };
    }
  }
  
  return { street: fullAddress, city: '', state: '' };
}

export async function updateGHLContact(
  apiKey: string,
  contactId: string,
  updates: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    customFields?: Array<{ id: string; field_value: string }>;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const body: any = {};
    if (updates.email) body.email = updates.email;
    if (updates.firstName) body.firstName = updates.firstName;
    if (updates.lastName) body.lastName = updates.lastName;
    if (updates.phone) body.phone = updates.phone;

    if (updates.address) {
      const parsed = parseAddress(updates.address);
      body.address1 = parsed.street;
      if (parsed.city) body.city = parsed.city;
      if (parsed.state) body.state = parsed.state;
      console.log(`Parsed address: street="${parsed.street}", city="${parsed.city}", state="${parsed.state}"`);
    }

    // Add custom fields if provided
    if (updates.customFields && updates.customFields.length > 0) {
      body.customFields = updates.customFields;
    }

    const response = await ghlFetch(`/contacts/${contactId}`, apiKey, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (response.ok) {
      console.log(`GHL contact ${contactId} updated successfully`);
      return { success: true };
    } else {
      const error = await response.json().catch(() => ({}));
      console.log(`GHL contact update failed: ${error.message || response.status}`);
      return {
        success: false,
        message: error.message || `Failed to update contact: ${response.status}`
      };
    }
  } catch (error: any) {
    console.log(`GHL contact update error: ${error.message}`);
    return {
      success: false,
      message: error.message || "Failed to update contact"
    };
  }
}

export async function getOrCreateGHLContact(
  apiKey: string,
  locationId: string,
  contact: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    customFields?: Array<{ id: string; field_value: string }>;
  }
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  const existingByEmail = await findGHLContactByEmail(apiKey, locationId, contact.email);

  if (existingByEmail.contactId) {
    console.log(`GHL contact found by email: ${existingByEmail.contactId}`);
    // Update with address and/or custom fields if provided
    if (contact.address || (contact.customFields && contact.customFields.length > 0)) {
      await updateGHLContact(apiKey, existingByEmail.contactId, {
        address: contact.address,
        customFields: contact.customFields
      });
    }
    return { success: true, contactId: existingByEmail.contactId };
  }

  const existingByPhone = await findGHLContactByPhone(apiKey, locationId, contact.phone);

  if (existingByPhone.contactId) {
    console.log(`GHL contact found by phone: ${existingByPhone.contactId}`);
    // Update with address and/or custom fields if provided
    if (contact.address || (contact.customFields && contact.customFields.length > 0)) {
      await updateGHLContact(apiKey, existingByPhone.contactId, {
        address: contact.address,
        customFields: contact.customFields
      });
    }
    return { success: true, contactId: existingByPhone.contactId };
  }

  console.log('GHL contact not found, creating new contact');
  return createGHLContact(apiKey, locationId, contact);
}
