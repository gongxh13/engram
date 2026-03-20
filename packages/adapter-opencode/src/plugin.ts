import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Event, Session, FileDiff } from '@opencode-ai/sdk';
import { SessionTracker } from './session-tracker.js';
import { appendSession } from '@engram/core';

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

        case 'session.idle':
          await tracker.finalizeSession(event.properties.sessionID);
          break;

        case 'session.deleted':
          await tracker.finalizeSession(event.properties.info.id);
          break;

        case 'session.diff':
          tracker.onSessionDiff(event.properties.sessionID, event.properties.diff);
          break;

        case 'session.error':
          tracker.onSessionError(event.properties.sessionID || '', event.properties.error);
          break;
      }
    },
  };
};
