import { SiteStrategy } from "./types";

export class LinkedInStrategy implements SiteStrategy {
  readonly name = "linkedin";

  matches(target: { url: string; title: string }): boolean {
    return /linkedin\.com/i.test(target.url);
  }

  getExpansionPlan() {
    return {
      clickTexts: [
        "see more",
        "show more",
        "read more",
        "...more",
        "more",
        "expand",
        "show all",
        "load more",
      ],
      maxRounds: 8,
      maxClicksPerRound: 18,
      scrollSelectors: ["main", "[role='main']", ".scaffold-layout__main", "body"],
      waitAfterInteractionMs: 700,
    };
  }

  getNotes(): string[] {
    return [
      "LinkedIn strategy enabled: repeated expansion passes, scroll-to-stable behavior, and PDF export are supported.",
    ];
  }
}
