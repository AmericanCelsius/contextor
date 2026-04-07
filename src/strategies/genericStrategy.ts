import { SiteStrategy } from "./types";

export class GenericStrategy implements SiteStrategy {
  readonly name = "generic";

  matches(): boolean {
    return true;
  }

  getExpansionPlan() {
    return {
      clickTexts: ["see more", "show more", "read more", "expand", "...more", "more", "continue reading"],
      maxRounds: 4,
      maxClicksPerRound: 10,
      scrollSelectors: ["main", "[role='main']", "body"],
      waitAfterInteractionMs: 450,
    };
  }

  getNotes(target: { url: string; title: string }): string[] {
    return [`Generic extraction for ${target.title || target.url}`];
  }
}
