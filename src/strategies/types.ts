import type { Page } from "playwright-core";

import type { BrowserAdapter } from "../adapters/browserAdapter";
import type { RunLogger } from "../core/logger";
import type { InstagramAuditPageData } from "../core/types";

export interface ExpansionPlan {
  clickTexts: string[];
  maxRounds: number;
  maxClicksPerRound: number;
  scrollSelectors: string[];
  waitAfterInteractionMs: number;
}

export interface ExtractedPageContent {
  title: string;
  url: string;
  html: string;
  markdown: string;
  text: string;
}

export interface SiteStrategy {
  readonly name: string;
  matches(target: { url: string; title: string }): boolean;
  getExpansionPlan(): ExpansionPlan;
  getNotes?(target: { url: string; title: string }): string[];
  postProcess?(content: ExtractedPageContent): ExtractedPageContent;
  extractInstagramList?(
    page: Page,
    adapter: BrowserAdapter,
    logger: RunLogger,
  ): Promise<InstagramAuditPageData | null>;
}
