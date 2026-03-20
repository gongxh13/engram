import type { Plugin } from '@opencode-ai/plugin';
import { SessionTracker } from './session-tracker.js';
import { appendSession, type EvalSession } from '@engram/core';

export const EngramPlugin: Plugin = async (ctx) => {
  const tracker = new SessionTracker(ctx.client);

  return {
    'session.created': async (input) => {
      const session = await ctx.client.session.get({ path: { id: input.sessionID } });
      tracker.onSessionCreated(input.sessionID, session.data);
    },

    'session.updated': async (input) => {
      tracker.onSessionUpdated(input.sessionID, input.properties);
    },

    'message.updated': async (input) => {
      if (input.properties?.status === 'done') {
        await tracker.onMessageDone(input.sessionID, input.messageID);
      }
    },

    'session.diff': async (input) => {
      tracker.onSessionDiff(input.sessionID, input.diff);
    },

    'session.idle': async (input) => {
      const sessionData = await tracker.finalizeSession(input.sessionID);
      if (sessionData) {
        appendSession(sessionData);
      }
    },

    'session.deleted': async (input) => {
      const sessionData = await tracker.finalizeSession(input.sessionID);
      if (sessionData) {
        appendSession(sessionData);
      }
    },

    'session.error': async (input) => {
      tracker.onSessionError(input.sessionID, input.error);
    },
  };
};
