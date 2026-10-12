# Acceptance review

The first-release sample is the fixture in `packages/core/test/review-sample.test.ts`. It covers 15 submitted sites: completed operator sites, a booking platform, a social profile, a directory listing, a blocked fetch, a failed fetch, and a page that does not mention the submitted business.

The test checks the section 20 targets that can be verified without a live browser:

- Quality is present only when the audit completed.
- Social, directory, blocked, and failed fetches leave quality and opportunity null.
- High opportunity scores include an explanation and do not invent revenue or an owner email.
- At least 10 summaries describe the host class and the measured result.

A staging pass should repeat the same checks on 15 live URLs the operator supplies, across at least five municipalities. Record the review notes in the lead, not a copy of the page HTML.
