export function bandLabel(band: string | null | undefined): string {
  switch (band) {
    case "very_high":
      return "Very high priority";
    case "high":
      return "High priority";
    case "qualified":
      return "Qualified";
    case "review":
      return "Review";
    case "low":
      return "Low priority";
    default:
      return "Not scored";
  }
}

export function hostLabel(status: string): string {
  switch (status) {
    case "OPERATOR_SITE":
      return "Company site";
    case "PLATFORM_SITE":
      return "Booking platform";
    case "SOCIAL_ONLY":
      return "Social profile";
    case "DIRECTORY_ONLY":
      return "Directory listing";
    case "UNREACHABLE":
      return "Unreachable";
    case "BLOCKED":
      return "Blocked";
    default:
      return status;
  }
}

export function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function serviceLabel(service: string | undefined): string {
  switch (service) {
    case "new_site":
      return "New website";
    case "redesign":
      return "Redesign";
    case "local_seo":
      return "Local SEO";
    case "booking":
      return "Booking presence";
    case "not_recommended":
      return "No pitch";
    case "insufficient_evidence":
      return "Needs review";
    default:
      return "Pending";
  }
}
