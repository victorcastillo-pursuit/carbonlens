import { AuditEvent, AuditEventType } from '../types';
import { generateUUID } from './crypto';

export function createAuditEvent(
  eventType: AuditEventType,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    id: generateUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function appendAuditEvent(
  log: AuditEvent[],
  eventType: AuditEventType,
  payload: Record<string, unknown>
): AuditEvent[] {
  return [...log, createAuditEvent(eventType, payload)];
}

export function auditLogToJson(log: AuditEvent[]): string {
  return JSON.stringify(log, null, 2);
}
