declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
  }
}

export interface AnalyticsConfig {
  gtmContainerId?: string;
  ga4MeasurementId?: string;
  facebookPixelId?: string;
  gtmEnabled?: boolean;
  ga4Enabled?: boolean;
  facebookPixelEnabled?: boolean;
}

let isInitialized = false;
let config: AnalyticsConfig = {};
let initializedProviders = { gtm: false, ga4: false, fbq: false };

// Events fired before initAnalytics() (settings still loading) wait here and
// are flushed once, so the first page view is not lost.
const MAX_QUEUED_EVENTS = 50;
let pageViewSeen = false;
let pendingEvents: Array<{ name: AnalyticsEventName; payload: AnalyticsEventPayload }> = [];

/**
 * One pipeline: GTM owns delivery when enabled (dataLayer only, the container
 * forwards to GA4); otherwise GA4 direct via gtag.
 */
function usesGtm() {
  return !!(config.gtmEnabled && config.gtmContainerId);
}
function usesGa4Direct() {
  return !usesGtm() && !!(config.ga4Enabled && config.ga4MeasurementId);
}

export function initAnalytics(settings: AnalyticsConfig) {
  // Only initialize analytics in production
  if (import.meta.env.DEV) {
    return;
  }

  config = settings;

  if (settings.gtmEnabled && settings.gtmContainerId && !initializedProviders.gtm) {
    injectGTM(settings.gtmContainerId);
    initializedProviders.gtm = true;
  }

  if (usesGa4Direct() && settings.ga4MeasurementId && !initializedProviders.ga4) {
    injectGA4(settings.ga4MeasurementId);
    initializedProviders.ga4 = true;
  }

  if (settings.facebookPixelEnabled && settings.facebookPixelId && !initializedProviders.fbq) {
    injectFacebookPixel(settings.facebookPixelId);
    initializedProviders.fbq = true;
  }

  isInitialized = true;

  const queued = pendingEvents;
  pendingEvents = [];
  queued.forEach((event) => trackEvent(event.name, event.payload));
}

function isGtagAvailable(): boolean {
  return typeof window.gtag === 'function';
}

function isFbqAvailable(): boolean {
  return typeof window.fbq === 'function';
}

function injectGTM(containerId: string) {
  if (!containerId || document.getElementById('gtm-script')) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js'
  });

  const script = document.createElement('script');
  script.id = 'gtm-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.insertBefore(noscript, document.body.firstChild);
}

function injectGA4(measurementId: string) {
  if (!measurementId || document.getElementById('ga4-script')) return;

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  // Page views are sent explicitly by trackPageView (SPA navigation).
  window.gtag('config', measurementId, { send_page_view: false });
}

function injectFacebookPixel(pixelId: string) {
  if (!pixelId || document.getElementById('fb-pixel-script')) return;

  const script = document.createElement('script');
  script.id = 'fb-pixel-script';
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);
}

export type AnalyticsEventName =
  | 'cta_click'
  | 'view_item_list'
  | 'view_item'
  | 'add_payment_info'
  | 'purchase'
  | 'contact_click'
  | 'page_view'
  | 'chat_open'
  | 'chat_close'
  | 'chat_message_sent'
  | 'chat_message_received'
  | 'chat_new_conversation'
  | 'chat_lead_captured'
  | 'form_open'
  | 'form_step_completed'
  | 'form_completed'
  | 'click_call'
  | 'click_email'
  | 'click_whatsapp'
  | 'click_social'
  | 'generate_lead'
  | 'form_abandoned'
  | 'form_result_action'
  | 'form_closed_draft';

export interface AnalyticsEventPayload {
  location?: string;
  label?: string;
  category?: string;
  value?: number;
  currency?: string;
  items?: Array<{
    item_id: string | number;
    item_name: string;
    price?: number;
    quantity?: number;
    item_category?: string;
  }>;
  transaction_id?: string;
  [key: string]: any;
}

export function trackEvent(eventName: AnalyticsEventName, payload: AnalyticsEventPayload = {}) {
  // Skip analytics tracking in development mode
  if (import.meta.env.DEV) {
    return;
  }

  if (!isInitialized) {
    if (pendingEvents.length < MAX_QUEUED_EVENTS) pendingEvents.push({ name: eventName, payload });
    return;
  }

  if (usesGtm()) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...payload
    });
  } else if (usesGa4Direct() && isGtagAvailable()) {
    window.gtag('event', eventName, payload);
  }

  if (eventName === 'page_view') {
    // The Pixel's init snippet already sent PageView for the first page; every
    // later SPA navigation needs an explicit one.
    if (pageViewSeen && config.facebookPixelEnabled && config.facebookPixelId && isFbqAvailable()) {
      window.fbq('track', 'PageView');
    }
    pageViewSeen = true;
    return;
  }

  // Meta receives `Lead` from form_completed; generate_lead is for GA4/GTM only.
  if (eventName === 'generate_lead') return;

  if (config.facebookPixelEnabled && config.facebookPixelId && isFbqAvailable()) {
    const fbEventMap: Record<string, string> = {
      'purchase': 'Purchase',
      'view_item': 'ViewContent',
      'view_item_list': 'ViewContent',
      'contact_click': 'Contact',
      'form_completed': 'Lead',
      'click_call': 'Contact',
      'click_email': 'Contact',
      'click_whatsapp': 'Contact',
    };

    const fbEvent = fbEventMap[eventName];
    if (fbEvent) {
      window.fbq('track', fbEvent, {
        content_name: payload.label,
        content_category: payload.category,
        value: payload.value,
        currency: payload.currency || 'USD',
        contents: payload.items?.map(item => ({
          id: item.item_id,
          quantity: item.quantity || 1
        }))
      });
    } else {
      window.fbq('trackCustom', eventName, payload);
    }
  }
}

export function trackPageView(path: string, title?: string) {
  trackEvent('page_view', { 
    page_path: path, 
    page_title: title || document.title 
  });
}

export function trackPurchase(
  transactionId: string,
  items: Array<{ id: number | string; name: string; price: number; quantity?: number }>,
  total: number
) {
  trackEvent('purchase', {
    transaction_id: transactionId,
    value: total,
    currency: 'USD',
    items: items.map(item => ({
      item_id: String(item.id),
      item_name: item.name,
      price: item.price,
      quantity: item.quantity || 1
    }))
  });
}

export function trackCTAClick(location: string, label: string) {
  trackEvent('cta_click', { location, label });
}

export function trackViewServices(category?: string, items?: Array<{ id: number | string; name: string; price: number }>) {
  trackEvent('view_item_list', {
    item_list_name: category || 'Services',
    items: items?.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: 1
    }))
  });
}

// Chat Analytics
export function trackChatOpen(pageUrl: string) {
  trackEvent('chat_open', {
    location: pageUrl,
    label: 'Chat Widget Opened'
  });
}

export function trackChatClose(pageUrl: string, messageCount: number) {
  trackEvent('chat_close', {
    location: pageUrl,
    label: 'Chat Widget Closed',
    value: messageCount
  });
}

export function trackChatMessageSent(pageUrl: string, conversationId?: string) {
  trackEvent('chat_message_sent', {
    location: pageUrl,
    label: 'Visitor Message',
    conversation_id: conversationId
  });
}

export function trackChatMessageReceived(pageUrl: string, conversationId?: string) {
  trackEvent('chat_message_received', {
    location: pageUrl,
    label: 'Assistant Response',
    conversation_id: conversationId
  });
}

export function trackChatNewConversation(pageUrl: string) {
  trackEvent('chat_new_conversation', {
    location: pageUrl,
    label: 'New Conversation Started'
  });
}

export function trackChatLeadCaptured(pageUrl: string, conversationId?: string) {
  trackEvent('chat_lead_captured', {
    location: pageUrl,
    label: 'Lead Captured via Chat',
    conversation_id: conversationId,
    category: 'lead_generation'
  });
}
