/// <reference lib="webworker" />

import { parseSurvey } from './parse-survey.ts';
import { summarize, type Survey } from './survey.ts';
import type { SurveyReply, SurveyRequest } from './survey-messages.ts';

const worker = self as unknown as DedicatedWorkerGlobalScope;
let surveyPromise: Promise<Survey> | undefined;

async function loadSurvey(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Survey CSV returned HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Some static hosts transparently decode assets served with Content-Encoding.
  const csv = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return parseSurvey(csv);
}

worker.addEventListener('message', async ({ data: { url, filters, request } }: MessageEvent<SurveyRequest>) => {
  let reply: SurveyReply;
  try {
    surveyPromise ??= loadSurvey(url);
    const survey = await surveyPromise;
    reply = { stats: summarize(survey, filters), request };
  } catch (error) {
    surveyPromise = undefined;
    reply = { error: error instanceof Error ? error.message : String(error), request };
  }
  worker.postMessage(reply);
});
