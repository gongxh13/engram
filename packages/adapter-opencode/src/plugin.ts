import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { SessionStatus, UserMessage, AssistantMessage, TextPart } from '@opencode-ai/sdk';
import { SessionTracker } from './session-tracker.js';

export const EngramPlugin: Plugin = async (input: PluginInput) => {
  const tracker = new SessionTracker(input.client);

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case 'session.created':
          tracker.onSessionCreated(event.properties.info);
          break;
        case 'session.updated':
          tracker.onSessionUpdated(event.properties.info);
          break;
        case 'session.status':
          const status = event.properties.status as SessionStatus;
          tracker.onSessionStatus(event.properties.sessionID, status.type);
          break;
        case 'session.diff':
          tracker.onSessionDiff(event.properties.sessionID, event.properties.diff);
          break;
        case 'message.updated': {
          const msg = event.properties.info as UserMessage | AssistantMessage;
          tracker.onMessageUpdated(msg);
          break;
        }
        case 'message.part.updated': {
          const part = event.properties.part as TextPart;
          if (part.type === 'text') {
            tracker.onMessagePartUpdated(part);
          }
          break;
        }
      }
    },
  };
};