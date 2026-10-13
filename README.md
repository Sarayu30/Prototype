# Cheerio Dashboard Demo

A clickable product-intern MVP exploring **contextual feature discovery** for Cheerio AI. The demo uses a coaching-institute scenario (Bright Path Academy) to test whether meaningful product activity can help users discover Analytics and Automations without interruptive, generic onboarding popups.

> **Prototype, not a live Cheerio integration.** Campaigns, activity events, and feature setup are demo data stored in the browser. This project does not connect to Cheerio customer accounts, messaging channels, or production analytics.

## What works in this prototype

- Demo sign-in and a multi-section dashboard with URL-based section navigation.
- Campaign draft and send interactions, plus activity tracking for campaign actions.
- Contextual Analytics recommendation logic based on campaign/report activity. The rule requires a meaningful pattern (including repeated report views within a 7-day window); one or two views alone should not qualify.
- Recommendation dismissal and saved recommendation state to avoid repeatedly showing the same prompt.
- A two-step Analytics setup flow that saves choices and can resume an in-progress setup; activation is represented in the demo.
- An Automations recommendation/setup flow driven by demo campaign activity.
- An optional AI-written Analytics explanation via a server-side Groq endpoint. Deterministic eligibility rules run first; AI is for wording, not deciding whether an unqualified feature should be recommended.
- Diagnostic/reviewer information for inspecting recommendation and Groq request status.
- Automated tests for recommendation, persistence, navigation, setup and Groq API behavior.

Feature availability and behavior are limited to the flows implemented in this repository; other Cheerio capabilities are not connected.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

To run the production build and tests:

```bash
npm run build
npm test
npm run preview
```

The project also includes `npm start`, a small Node server intended to serve the built `dist` app and the Groq explanation endpoint.

## Demo sign-in

- **Email:** `ravi@brightpath.edu`
- **Password:** `cheerio123`

These are hard-coded demo credentials, not real authentication. Do not use them as a production security boundary.

## Groq setup (optional)

1. Copy `.env.example` to `.env`.
2. Set `GROQ_API_KEY` to your own key.
3. Optionally set `GROQ_MODEL`; the default model is `openai/gpt-oss-20b`.
4. Run the app with the provided Node/Vite setup.

The browser calls the app's `/api/analytics-explanation` endpoint; the Groq key is read by server-side code and must never be added to frontend environment variables or committed to Git. Keep `.env` private. If no key is configured or the AI request fails, the app can use its fallback explanation.

For deployment, configure `GROQ_API_KEY` as a **server-side environment variable** on a host that supports the Node server/API route. A static-only host will not run `server.mjs` or the Groq endpoint without additional serverless/hosting configuration.

## Persistence and limitations

- Campaigns, tracked events, recommendation state, demo session, and setup progress use browser `localStorage`.
- State persists across refreshes in the same browser profile, but it is **not account-level or cross-device persistence**. Clearing browser data removes it.
- Demo sign-in is not backed by an identity provider or database.
- Feature activation is simulated; no real campaign, automation, chatbot, CRM or analytics service is activated.
- Activity is simulated/locally generated. Recommendations must not be interpreted as conclusions from real customer data.
- The prototype's recommendation rules and example thresholds are hypotheses to validate with real usage research and experiments.

## Main implementation areas

- `src/App.tsx` — app shell, sign-in, dashboard, and user flows.
- `src/campaignStore.ts` — campaign events, local persistence, and Analytics recommendation eligibility.
- `src/analyticsSetup.ts` — resumable Analytics setup state.
- `src/automationStore.ts` and `src/automationsSetup.ts` — Automations recommendation/setup state.
- `src/analyticsExplanation.ts` and `server/groq-api.mjs` — client request helper and server-side Groq API handler.
- `tests/` — automated behavior tests.

## Assignment context

The product hypothesis is that **a relevant suggestion at the right moment, with a simple starter and a respectful dismissal/resume lifecycle**, may help users discover useful features. This prototype demonstrates the interaction and state logic; it does not prove retention impact. A production evaluation should measure meaningful feature adoption and repeat usage against a suitable comparison group.
