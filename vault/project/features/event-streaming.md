---
title: Event Streaming
type: project
category: features
tags:
  - feature
  - streaming
  - platform-events
  - cometd
  - grpc
  - pub-sub
  - change-data-capture
  - push-topics
aliases:
  - Events Tab
created: 2026-02-08
updated: 2026-02-28
status: active
related-code:
  - src/components/events/
  - src/api/streaming.ts
  - sftools-proxy/src/handlers/streaming.js
confidence: high
---

# Event Streaming

## Overview

The Events tab enables subscribing to Salesforce Platform Events, Change Data Capture, PushTopics, and System Topics. **Requires the [[native-proxy|Native Proxy]] to be connected** — shows connection prompt when proxy is offline.

## How It Works

### Channel Types

| Channel Pattern | Protocol | Use Case |
|-----------------|----------|----------|
| `/event/*` | gRPC (Pub/Sub API) | Platform Events |
| `/topic/*` | CometD (Bayeux) | PushTopics |
| `/data/*` | CometD | Change Data Capture |
| `/systemTopic/*` | CometD | System Topics (e.g., Logging) |

### Event Flow

1. `getAllStreamingChannels()` discovers available channels
2. User selects channel + replay option (Latest, Earliest, custom replay ID)
3. Extension sends `subscribe` message to background service worker
4. Service worker forwards to native proxy via Native Messaging
5. Proxy routes to gRPC or CometD based on channel pattern
6. Events pushed back: `streamEvent` → service worker → extension page
7. Events displayed in real-time list
8. User can also publish Platform Events via `publishPlatformEvent()`

### Key Components

| Component | Purpose |
|-----------|---------|
| `EventsTab.tsx` | Main tab (proxy check + streaming UI) |
| `ChannelSelector.tsx` | Channel discovery + selection |
| `EventPublisher.tsx` | Publish Platform Events |
| `EventsSettingsModal.tsx` | Replay settings modal (start position, replay ID) |

## UI Changes

> [!note] PR #139 Redesign
> The Events tab received several UX improvements in the PR #139 redesign.

- **Newest-first ordering** — events are displayed in reversed order so the most recent event appears at the top of the list
- **gRPC replay ID decoding** — base64-encoded replay IDs from the Pub/Sub API are decoded to readable numeric strings for display
- **Collapsible EventPublisher** — the EventPublisher card uses [[collapse-chevron|CollapseChevron]] and can be collapsed to reduce visual noise
- **Channel column removed** — the Channel column was removed from the event display table

## Key Files

- `src/components/events/` — Events UI components
- `src/api/streaming.ts` — `getAllStreamingChannels`, `publishPlatformEvent`
- `sftools-proxy/src/handlers/streaming.js` — Subscribe/unsubscribe routing
- `sftools-proxy/src/grpc/pubsub-client.js` — gRPC Pub/Sub client
- `sftools-proxy/src/cometd/cometd-client.js` — CometD/Faye client

## Related

- [[overview|System Architecture Overview]]
- [[native-proxy|Native Proxy]]
- [[background-service-worker|Background Service Worker]]
- [[salesforce-apis|Salesforce APIs]]
- [[salesforce-api-client|Salesforce API Client]]
- [[chrome-extension-mv3|Chrome Extension MV3]]
