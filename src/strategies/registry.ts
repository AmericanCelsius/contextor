import { GmailStrategy } from "./gmailStrategy";
import { GenericStrategy } from "./genericStrategy";
import { InstagramStrategy } from "./instagramStrategy";
import { LinkedInStrategy } from "./linkedInStrategy";
import { PortalStrategy } from "./portalStrategy";
import { SiteStrategy } from "./types";

const STRATEGIES: SiteStrategy[] = [
  new LinkedInStrategy(),
  new GmailStrategy(),
  new PortalStrategy(),
  new InstagramStrategy(),
  new GenericStrategy(),
];

export function getEnabledStrategies(enabledNames: string[]): SiteStrategy[] {
  return STRATEGIES.filter((strategy) => enabledNames.includes(strategy.name));
}

export function resolveStrategy(
  target: { url: string; title: string },
  enabledNames: string[],
  preferredMode?: string,
): SiteStrategy {
  const enabled = getEnabledStrategies(enabledNames);

  if (preferredMode) {
    const preferred = enabled.find((strategy) => strategy.name === preferredMode);
    if (preferred) {
      return preferred;
    }
  }

  return enabled.find((strategy) => strategy.matches(target)) ?? new GenericStrategy();
}
