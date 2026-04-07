import { SiteStrategy } from "./types";

export class PortalStrategy implements SiteStrategy {
  readonly name = "portal";

  matches(target: { url: string; title: string }): boolean {
    return /(brightspace|gradescope|edstem|canvas|blackboard|moodle|course|assignment)/i.test(
      `${target.url} ${target.title}`,
    );
  }

  getExpansionPlan() {
    return {
      clickTexts: ["show more", "see more", "expand", "view rubric", "load more", "read more"],
      maxRounds: 6,
      maxClicksPerRound: 12,
      scrollSelectors: ["main", "[role='main']", ".d2l-page-main", "body"],
      waitAfterInteractionMs: 550,
    };
  }

  getNotes(): string[] {
    return ["Course portal extraction mode: optimized for assignment pages, announcements, and grade summaries."];
  }
}
