import { SiteStrategy } from "./types";

export class GmailStrategy implements SiteStrategy {
  readonly name = "gmail";

  matches(target: { url: string; title: string }): boolean {
    return /(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com|webmail)/i.test(target.url);
  }

  getExpansionPlan() {
    return {
      clickTexts: ["show trimmed content", "show more", "view entire message", "more", "expand"],
      maxRounds: 4,
      maxClicksPerRound: 10,
      scrollSelectors: ["div[role='main']", "main", "body"],
      waitAfterInteractionMs: 500,
    };
  }

  getNotes(): string[] {
    return ["Read-only communication extraction mode: intended for message context, never for sending or deleting."];
  }
}
