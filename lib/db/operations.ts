/**
 * Operations Tables Database Helpers - Re-exports
 *
 * This file re-exports all operations from domain-specific modules
 * for backward compatibility. New code should import directly from
 * the specific module (e.g., '@/lib/db/faq', '@/lib/db/knowledge').
 *
 * Spec Reference: Part 9, Lines 937-1054
 */

// FAQ Helpers
export {
  getFAQsByBusinessId,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  bulkCreateFAQs,
  reorderFAQs,
} from './faq';

// Knowledge Helpers
export {
  getKnowledgeByBusinessId,
  upsertKnowledge,
  updateKnowledge,
} from './knowledge';

// AI Config Helpers
export {
  getAIConfigByBusinessId,
  upsertAIConfig,
  updateAIConfig,
  updateSystemPrompt,
} from './ai-config';

// Call Settings Helpers
export {
  getCallSettingsByBusinessId,
  upsertCallSettings,
  updateCallSettings,
} from './call-settings';

// Calendar Integration Helpers
export {
  getCalendarIntegrationByBusinessId,
  upsertCalendarIntegration,
  updateCalendarIntegration,
  updateCalendarTokens,
  calendarTokensNeedRefresh,
} from './calendar';

// Availability Slots Helpers
export {
  getAvailabilitySlotsByBusinessId,
  getAvailabilitySlotsByDay,
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  replaceAvailabilitySlots,
  // Business Hours
  getBusinessHoursById,
  updateBusinessHoursById,
  // Blocked Dates
  getBlockedDates,
  getBlockedDatesInRange,
  addBlockedDate,
  removeBlockedDate,
  isDateBlocked,
  // Service Availability
  getServiceAvailability,
  getServicesAvailabilityByBusinessId,
  updateServiceAvailability,
  setServiceUseBusinessHours,
  hasCustomAvailability,
} from './availability';

// Phone Number Helpers
export {
  getPhoneNumbersByBusinessId,
  getActivePhoneNumber,
  getPhoneNumberByNumber,
  createPhoneNumber,
  updatePhoneNumber,
  deactivatePhoneNumber,
  setActivePhoneNumber,
} from './phone';

// SMS Message Helpers
export {
  getSMSMessagesByBusinessId,
  getSMSMessagesByCallId,
  createSMSMessage,
  updateSMSMessageStatus,
  type SMSMessageInsert,
  type SMSMessageUpdate,
} from './sms';

// Notification Settings Helpers
export {
  getNotificationSettingsByBusinessId,
  upsertNotificationSettings,
  updateNotificationSettings,
  type NotificationSettingsInsert,
  type NotificationSettingsUpdate,
} from './notifications';

// Privacy/GDPR Helpers
export {
  getDataRequestsByUserId,
  getDataRequestById,
  getPendingDeletionRequest,
  createDataRequest,
  updateDataRequest,
  cancelDeletionRequest,
  createExportRequest,
  getBusinessExportData,
  createDeletionRequest,
  cancelDeletionAndRestore,
  type DataRequest,
  type DataRequestType,
  type DataRequestStatus,
  type BusinessExportData,
} from './privacy';

// Webhook Helpers
export {
  getWebhooksByBusinessId,
  getActiveWebhooksByEvent,
  getWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  toggleWebhookActive,
  createWebhookDelivery,
  updateWebhookDelivery,
  getWebhookDeliveries,
  getPendingRetryDeliveries,
  markDeliverySuccess,
  markDeliveryForRetry,
  getWebhookStats,
  generateWebhookSecret,
  WEBHOOK_EVENT_TYPES,
  type Webhook,
  type WebhookInsert,
  type WebhookUpdate,
  type WebhookDelivery,
  type WebhookDeliveryInsert,
  type WebhookDeliveryStatus,
  type WebhookEventType,
} from './webhooks';
