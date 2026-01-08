const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-04-15";

export interface GHLFreeSlot {
  slots: string[];
}

export interface GHLFreeSlotsResponse {
  [date: string]: GHLFreeSlot;
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

export async function getGHLFreeSlots(
  apiKey: string,
  calendarId: string,
  startDate: Date,
  endDate: Date,
  timezone: string = "America/New_York"
): Promise<{ success: boolean; slots?: GHLFreeSlotsResponse; message?: string }> {
  try {
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

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
      return { success: true, slots: data };
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
  }
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  try {
    const response = await ghlFetch("/contacts/", apiKey, {
      method: "POST",
      body: JSON.stringify({
        locationId,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        address1: contact.address,
      }),
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

export async function createGHLAppointment(
  apiKey: string,
  calendarId: string,
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
        contactId: appointment.contactId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        title: appointment.title,
        address: appointment.address,
        status: "confirmed",
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

export async function getOrCreateGHLContact(
  apiKey: string,
  locationId: string,
  contact: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
  }
): Promise<{ success: boolean; contactId?: string; message?: string }> {
  const existing = await findGHLContactByEmail(apiKey, locationId, contact.email);
  
  if (existing.contactId) {
    return { success: true, contactId: existing.contactId };
  }
  
  return createGHLContact(apiKey, locationId, contact);
}
