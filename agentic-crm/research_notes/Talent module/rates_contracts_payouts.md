# Talent module: pay rates, deal terms, e-signature, payouts and compliance (as of 2026-11-10)

**Scope.** Research done on 2026-11-10 for Magpie's Talent module ([rebuild/modules/TALENT.md](../../rebuild/modules/TALENT.md)). In that module, Bots propose rates and terms, send offers once the customer approves, collect a signed agreement, track deliverables and pay the creator.
- The focus is the US. EU and UK rules are noted where they differ.
- These notes feed three parts of TALENT.md: §10 (Agreements and payouts), §11 (Plans and metering) and the `rate_benchmarks` seed table in §5.
- This is not legal or tax advice. Items marked **Counsel** need a lawyer or CPA before launch.

**Labels**

| Label | Meaning |
|---|---|
| **[V-doc]** | Verbatim from page text I extracted myself: Stripe docs returned as raw markdown, and the FinCEN ruling PDF run through `pdftotext`. |
| **[V-fetch]** | Verbatim as returned by the fetch tool. A small model extracts these quotes, so spot-check them before using any in customer-facing copy. |
| **[S]** | From a search-engine summary. The page was not opened or was blocked. Treat as unconfirmed. |
| **[P]** | My paraphrase. This includes statutes I cite from knowledge; those are also marked "not re-fetched". |
| **Vendor** | A vendor talking about its own product or a competitor's. |
| **Market data** | Prices measured on a marketplace and published by that marketplace. Self-interested, but measured. |
| **Independent** | Government, statute, court, or a party with no product at stake. |

**Access limits** (no workarounds attempted):
- These returned 403 or a Cloudflare challenge:
  - collabstr.com, including the 2026 report and calculators;
  - upwork.com cost pages;
  - izea.com;
  - Fiverr's cost guide;
  - the bls.gov news-release PDF. The BLS Occupational Outlook pages did load.
- ecfr.gov redirects to a block page, so I used law.cornell.edu for 16 CFR.
- The fetch tool refuses web.archive.org.
- Figures from the blocked sources appear only through search summaries or secondary articles, and are labeled [S].

---

## Strongest findings (one screen)

1. **Measured market prices for small creator deals are low.**
   - Collabstr's 2026 report (21,000+ collaborations on its marketplace in 2025):
     - "Nearly 80% of influencer collaborations cost under $300", and "only 2% exceed $1,000".
     - Average payout per engagement: YouTube $255, Instagram $193, TikTok $186.
     - UGC: average asking price $180, average paid $154 [S].
   - Pitchlo: median UGC offer of $100 per video, interquartile range $50 to $200, across 645 briefs posted Dec 2025 to Oct 2026 [S].
   - Agency and blog rate cards (Later, Influencer Marketing Hub) run 2 to 5 times higher and publish no methodology.
2. **UGC marketplaces bundle the rights into a low price; influencer practice prices rights separately.**
   - Billo sells videos from $99. Its creator terms (effective 2026-10-01) take an "irrevocably assign and transfer to the Brand all rights" grant, worldwide [V-fetch].
   - Insense gives brands "perpetual digital rights" once content is approved and paid [S, Vendor].
   - Practitioners (33 quoted by Net Influencer, 2026-09-11) default to expiring windows and price perpetual rights at 2 to 5 times the base fee or more [V-fetch].
3. **Price paid-ads usage as an add-on.**
   - Practitioners (2026-09-11) [V-fetch]:
     - 30 days: about +20% to +35% of the base fee;
     - 1 year: about +75% to +150%;
     - perpetual: at least 2 to 3 times.
   - Later (2026-07-07): "Add 30–50% to your base rate" for whitelisting [V-fetch].
   - Collabstr 2025: campaigns with usage rights averaged $307 against $221 without, a 39% difference [S].
   - TikTok Spark authorizations last 7, 30, 60 or 365 days; the API also accepts 180 [S].
4. **A well-built click-to-accept agreement is legally enough for small creator deals.**
   - ESIGN §7001(a) [V-fetch]: a record "may not be denied legal effect, validity, or enforceability solely because it is in electronic form". Its consumer-consent rules in §7001(c) apply to consumers, not to a creator acting in business.
   - The 4th Circuit held in *MRIS v. AHRN* (2013) that an electronic agreement can transfer copyright under §204(a) [S].
   - For the agreement to form, the creator needs conspicuous notice and a click they are told means assent (*Berman*, 9th Cir. 2022) [S].
   - **Never use "work made for hire" with California individuals.** Cal. Labor Code §3351.5(c) and Unemployment Insurance Code §686 make the commissioning party their employer for those statutes' purposes [V-fetch].
5. **Stripe Connect is the cleanest payout rail for a US-first SaaS.**
   - Stripe on Connect payouts: "Stripe handles licensing requirements, and your platform isn't part of the payout funds flow."
   - Stripe on Global Payouts: "If you manage your customers' funds, you might need a license such as an MTL." [V-doc]
   - Cost [V-fetch]:
     - $2 per active account per month, plus 0.25% + 25¢ per payout;
     - 1099 forms at $2.99 per IRS e-file, $1.49 per state filing and $2.99 per mailed copy.
   - Limits [V-doc]:
     - Self-serve cross-border payouts work only among the US, UK, EEA, Canada and Switzerland.
     - A platform that controls pricing must file the 1099s itself.
6. **The 2026 tax thresholds changed** [S, IRS]:
   - Form 1099-NEC/MISC: $2,000 for payments after 2025-12-31 (One Big Beautiful Bill Act, OBBBA).
   - Form 1099-K: back to more than $20,000 and more than 200 transactions, retroactively.
   - A transaction reportable on both should go "only" on the 1099-K (IRS FAQ Q11) [V-fetch].
   - Several states keep 1099-K thresholds of $600 to $2,500 [V-doc, Stripe's 2026 table].
7. **The FTC's 2024 reviews rule reaches UGC ads.**
   - The rule (16 CFR 465, in force since 2024-10-21) covers a "consumer testimonial": an ad viewers take to reflect a buyer's experience.
   - Disseminating a testimonial that misrepresents that the person used the product is prohibited [V-fetch].
   - Penalties reach $53,088 per violation; the amount is unchanged for 2026 [S].
   - The Endorsement Guides require the endorser to have been "a bona fide user" (16 CFR 255.1(c)) [V-fetch].
   - The FTC sent its first warning letters under Part 465 in December 2025. I found no filed case.
   - **Consequence:** the product must ship and be used before a testimonial-style script is filmed.
8. **State freelancer laws make payment timing a compliance matter.** Each requires a written contract and sets a 30-day default when the contract names no payment date:
   - California SB 988: $250 or more, from 2025-01-01; give a signed copy and keep it 4 years [V-fetch].
   - Illinois: $500 or more per 120 days [V-fetch].
   - New York State: $800 or more, counting the prior 120 days [S].
9. **Minors: the v1 "18 or older only" ruling (TALENT.md T4) is right.**
   - California AB 1880 brings child content creators under the Coogan law: 15% of earnings to a trust, deposited by the employer.
   - California SB 764: 65% to a trust when a minor appears in at least 30% of content.
   - Minnesota bars children under 14 from content-creation work (effective 2025-07-01).
   - Illinois and Utah have trust laws.
   - TikTok One requires creators to be 18 or older [V-fetch/S].
10. **How done-for-you and UGC operations staff and police quality.**
    - Feedbird: plans start at $99/month for 10 posts and $149/month for 5 short videos [V-fetch]. It hires editors at about $600 to $800 a month part-time, after an editing test and a two-week paid trial, according to one job listing [S].
    - UGC marketplaces run quality control through capped revisions, auto-approval timers and creator ratings. Billo's Premium tier requires 14 approved videos, an average rating of 4.8 or higher and on-time delivery of 90% or more [V-fetch].

---

## 1. Pay-rate benchmarks (US, 2025–2026)

### Takeaway
- **Use measured marketplace data as the anchor and agency rate cards as the ceiling.** For a typical US UGC video, a credible creator-fee median is about **$150**, with an interquartile range of about $100 to $250. That price covers creation, editing, one hook and organic use.
- **Paid usage, whitelisting, extra hooks, raw files and rush are add-ons**, priced as a percentage of the base fee.
- **Influencer posts on nano and micro accounts mostly settle in the low hundreds** on self-serve marketplaces. Agency guides quote $500 to $2,500 for micro accounts.
- **Freelance hourly medians on global marketplaces sit at $25 to $35 an hour.** That reflects offshore supply. US employee medians are about $30 to $36 an hour.
- **Very little data has a disclosed method.** Seed `rate_benchmarks` with a source and an `as_of` date on every row, and let workspace history override the seeds.

### 1.1 What each source measures

| Source | Date | Type | Method and sample | What it measures |
|---|---|---|---|---|
| Collabstr 2026 Influencer Marketing Report | Published about Jan 2026; covers 2025 | Market data | "anonymised platform data from 21,000+ collaborations, 200,000 creators, 472,000+ listings and 2.3 million searches" ([storyboard18, 2026-03-20](https://www.storyboard18.com/how-it-works/80-influencer-deals-under-300-brands-shift-to-ugc-report-92782.htm)) [V-fetch] | Prices asked and paid on a self-serve marketplace; skews toward small creators and small brands |
| Pitchlo UGC Pay Report | Briefs posted Dec 2025 to Oct 2026 | Market data | 645 per-video UGC briefs, via [knowlify](https://knowlify.com/articles/ugc-creator-rates) [S] | The offer posted on a brief, not the price accepted |
| Fiverr content-creator cost guide | 2026 | Market data | "recent marketplace data" [S] | UGC package prices on Fiverr |
| Billo pricing and help center | Oct and Nov 2026 | Vendor price list | None | What a brand pays per video, including the creator's payout and Billo's fee |
| Insense pricing | Fetched 2026-11-10 | Vendor | None | Starting creator fee, plus subscription and marketplace fees |
| Influencer Marketing Hub, [rates page](https://influencermarketinghub.com/influencer-rates/) | Updated 2026-10-06 | Publisher; no methodology | "These are planning benchmarks, not fixed rate cards." [V-fetch] | Price ranges per post, by tier and platform |
| Later, [pricing benchmarks](https://later.com/blog/influencer-pricing-benchmarks-the-complete-2026-guide/) | 2026-07-07 | Vendor (influencer platform); no methodology | Its Incentive Advisor "uses verified campaign data", not disclosed [V-fetch] | Tier ranges and usage percentages |
| Elev8or, [creator rate report](https://www.elev8or.io/creator-rate-report-2026) | June 2026 | Vendor index model | No sample; "directional planning ranges, not quotes" [V-fetch] | Instagram bands multiplied by a per-platform index |
| IZEA, State of Influencer Earnings | 2023 edition, 2022 data (**older**) | Market data from IZEA's marketplace, which serves larger brands | Marketplace transactions [S] | Average price per sponsored post by tier |
| Net Influencer, [33 practitioners](https://www.netinfluencer.com/one-fee-no-expiration-33-creator-economy-professionals-on-whether-perpetual-usage-rights-are-ever-a-fair-deal/) | 2026-09-11 | Opinions from agencies and talent managers | Not a statistical survey | Multipliers for usage rights |
| Upwork "hire/cost" pages | 2026 | Market data; global talent | Upwork calls its figures "historical or estimated" [S] | Hourly ranges and medians, worldwide |
| BLS, Occupational Employment and Wage Statistics (OEWS) | May 2025 data, published 2026 | **Independent** | Employer survey | Median wages for US employees, not freelancers |
| HeyOrca social media manager survey | May 2024 (**older**) | Vendor survey | "100+ agency and freelance social media managers" [S] | Hourly rates and retainers |

### 1.2 UGC videos (creator fee per video)

**Market data**
- Collabstr 2026 report: UGC averages $180 asked and $154 paid per engagement. A separate "average UGC campaign cost" figure fell from $209 to $197 [S]. [Hello Partner](https://hellopartner.com/2026/01/13/industry-report-reveals-the-7-influencer-marketing-trends-defining-2026) (2026-01-13) quotes "average costs under $197 (a 5% decrease from last year)" [V-fetch]. Other report figures:
  - UGC campaigns "grew 133% year-on-year" and reached 35% of campaigns.
  - "Over 40% of UGC buyers spend less than $5,000 in total" (storyboard18) [V-fetch].
- Pitchlo [S]:
  - Median offer $100 per video; half of listings between $50 and $200; top tenth at $338 or more.
  - October 2026 medians by niche: tech $90, beauty $100, lifestyle $120, other $150.
- Fiverr: "user-generated content packages average $117 to $155" [S].

**Vendor prices**
- **Billo** ([pricing](https://billo.app/pricing/), [pricing blog, 2026-11-06](https://billo.app/blog/how-billo-pricing-works/)):
  - "Billo videos start at $99 per video", which is "a 15-second video from a regular creator with basic editing" [V-fetch].
  - A hidden pop-up on the site reads "$99 for a 15-second video, $139 for 30 seconds and $169 for 60 seconds". With Billo's editing the same lengths cost $164, $204 and $234 [S, via [Novoads, 2026-10-22](https://novoads.ai/en/blog/billo-pricing), which says the pop-up may be stale].
  - The price includes "Creator payout", "Billo software" and "Transaction fees" ([help center](https://help.billo.app/en/articles/4920470-how-do-i-pay-content-creators-for-the-videos-they-create)) [V-fetch].
  - Creator payouts start at $30 per video (Billo developer reply in the App Store) [S]. Four photos pay the creator "an additional $40" [V-fetch].
- **Insense** ([pricing](https://insense.pro/pricing)) [V-fetch]:
  - "UGC campaigns start at $100 per video".
  - Sponsored posts "begin at $125 for nano-influencers".
  - Creator pay sits on top of the subscription ($400 to $800 a month) and the marketplace fee (7% to 20%).
- **Rate guides from creator-tool vendors** (not verified) [S]:
  - Beginners $75 to $300 per video, mid-level $300 to $1,000.
  - Extra hook or CTA variations "$50 each" or "$50–$100 per variation"; editors quote $40 to $80.
  - Raw footage +30% to 50%, or $50 to $150 flat.
  - Rush +25% to 50%.

**Length.** Billo's ladder of $99, $139 and $169 means 15 to 30 seconds costs 1.40 times as much, and 30 to 60 seconds 1.22 times. This is the only length data I found.

### 1.3 Usage rights, paid ads, whitelisting and Spark or partnership ads

- **Practitioner multipliers** ([Net Influencer, 2026-09-11](https://www.netinfluencer.com/one-fee-no-expiration-33-creator-economy-professionals-on-whether-perpetual-usage-rights-are-ever-a-fair-deal/)) [V-fetch]:

  | Practitioner | 30 days | 1 year | Perpetual |
  |---|---|---|---|
  | Dan Albert, CEO, 456 Growth | +0.35x | +1.5x | +3 to 5x |
  | Josh Stein, CEO, Attention Capital | Base | 3 to 5x | 8 to 12x the 30-day rate |
  | Makenna Peach, Open Influence | 20% to 30% of the creation fee | 75% to 150% | at least 2 to 3x |
  | Shawn Munir, Yamammi | Waived | +100% to 200% | 3 to 5x |

  - Consensus: rights should expire by default and be renewable. "30 days is the most common base window."
  - Quotes: "Perpetuity isn't the problem. Free perpetuity is." (Albert). "Default to a window. 30 to 180 days, then renew." (Stein).
- **Later** (2026-07-07) [V-fetch]:
  - Whitelisting: "Add 30–50% to your base rate when you want to run creator content as paid ads".
  - Usage rights "typically add 30–50% to the base rate".
  - Spark Ads carry "an additional fee", with no percentage.
  - Rush fees apply to timelines "usually anything under two weeks".
- **Collabstr 2025 report:** campaigns with usage rights averaged $307 against $221 without, a 39% difference across all campaign types [S].
- **Whitelisting and Spark codes per 30 days:** guides cite "20–25% of a content creator's base rate per 30-day flight" and "25-30% usage fee per 30 days". A sample addendum offers prepay discounts: 90 days −10%, 180 days −20%, 365 days −30% [S, IMH addendum and others]. An Insense cheatsheet puts whitelisting or Spark at $100 to $150 a month [S].
- **Platform mechanics:**
  - TikTok: creators choose an authorization of "7, 30, 60, or 365 days". The Business API `authorization_days` field accepts "7, 30, 60, 180, 365" with "Default value: 30". The Content Suite defaults to 365 [S, TikTok help and API docs].
  - Meta partnership ads: ad codes "can be used by up to 2 advertisers at a time", and "Creators and other partners can revoke these permissions at any time" [S, Instagram help].

### 1.4 Influencer posts by follower tier

| Source (type, date) | TikTok | Instagram | YouTube / Shorts |
|---|---|---|---|
| Collabstr 2025 activity (market data) | average payout $186 | $193; a 2025 summary says Reels averaged $288 against $217 for TikTok [S] | YouTube $255 |
| IMH (no method, 2026-10-06) | nano $50–$200; micro $200–$800; macro (100K–1M) $800–$5,000 | nano static $10–$50, Reels $20–$100; micro $100–$500; mid $500–$5,000+ | nano $20–$200; micro $200–$1,000; mid $1,000–$10,000; **Shorts nano $20–$100, no other tiers** [V-fetch] |
| Later (no method, 2026-07-07) | nano $200–$500; micro $800–$2,500 (Reels/TikTok) | nano feed $100–$300; micro feed $500–$1,500; Reels +20% to 30% | Shorts "lower range", no figures [V-fetch] |
| Elev8or (index model, 2026-06) | micro $213–$1,275 | nano $50–$250; micro $250–$1,500; mid $1,500–$5,000 | micro YouTube $425–$2,550 [V-fetch] |
| IZEA (2022 data, **older**) | n/a | average across platforms: nano $1,105, micro $1,674, mid (50K–199K) $3,396 | n/a [S] |
| Shorts-specific blogs (no method) | — | — | micro $100–$2,000 per Short; "40–60% below equivalent TikTok rates" [S] |

The spread is about ten times within one tier. The self-serve marketplace average (Collabstr, about $190 across platforms) sits at the bottom of every agency range. IZEA's averages are high because its buyers are larger brands and the data is from 2022.

### 1.5 Freelancers: social media managers, short-form video editors and graphic designers

- **Social media managers**
  - Upwork's cost page puts them at $14 to $35 an hour. Its project estimates run $300 to $1,000 for single-platform content and $3,000 to $7,000 for full strategy [S].
  - HeyOrca's 2024 survey (100+ respondents, **older**): about $67 an hour on average and about $2,107 a month for one client on three platforms. Freelancers ranged from $49.50 an hour (under one year) to $92.23 (7+ years) [S].
  - SoloHourly reports a 2026 median retainer of $2,250 a month, with no method [S].
- **Short-form video editors**
  - Upwork: "Hourly rates for Video Editors on Upwork typically range between $10 and $60", with a median of $35. Tiers: entry below $30 (median $10), mid $31 to $60 (median $40), senior $61 to $150 (median $100) [S].
  - Upwork project estimates run "$75 for a simple single-video edit to $3,000 or more per month" [S].
  - Upwork Reel gigs: one seller charges $25, $120 or $240; another $15, $40 or $80. Low-end job posts pay $5 to $50 per clip [S].
  - BLS (May 2025): median annual wage for film and video editors $75,420, about $36.26 an hour; 35% are self-employed ([OOH](https://www.bls.gov/ooh/media-and-communication/film-and-video-editors-and-camera-operators.htm)) [V-fetch].
- **Graphic designers**
  - Upwork: typical $15 to $35 an hour, median $25; designers "often set a fixed price" [S].
  - BLS (May 2025): median $62,960 a year, or $30.27 an hour ([OOH](https://www.bls.gov/ooh/arts-and-design/graphic-designers.htm)) [V-fetch].
- **Done-for-you price floor.** Feedbird charges clients $99 a month for 10 designed posts with captions and $149 a month for 5 short videos, made by its own offshore team (§6). That works out to about $10 per post and $30 per video at the client price [V-fetch].

### Inferences
- **UGC creator fee for 30 seconds, edited, one hook: median $150, quartiles $100 to $250.** This fits Collabstr's $154 paid, Fiverr's $117 to $155, Billo's $139 brand price for 30 seconds (which includes its fee and a payout of $30 or more), and Pitchlo's $100 median offer. It sits below the $300+ "pro" rates in blog guides.
- **Length multipliers, from Billo's ladder:** 15 seconds ×0.75, 30 seconds ×1.0, 60 seconds ×1.25. For 90 to 120 seconds, ×1.5 is my extrapolation.
- **Raw versus edited.** Billo's editing add-on of +$65 on a $139 base implies raw-only is worth about 70% of an edited video. I would treat raw files delivered alongside the edit as a flat add-on of about $50.
- **Hooks.** An extra hook re-records only the first 3 to 5 seconds, so about $50 flat at the median, or about 30% of base. A full variation with a new script is closer to 60% of base. Guides quote $50 to $100 per variation.
- **Rights default.**
  - Organic use on the brand's own channels comes with the base fee. Paid usage costs extra.
  - Because UGC marketplaces bundle perpetual rights at about 1x, a perpetual UGC buyout at 2x is defensible.
  - Influencer content, where the creator's own audience is part of the value, should be at 3x or more. That is the low end of the practitioner range.
- **Freelancers.** Upwork's global medians undercut US supply. BLS employee medians plus about 25% to 40% (self-employment tax and no benefits) give a defensible floor for US contractors: about $40 to $50 an hour for editors and designers. The Upwork medians suit offshore talent.

### Gaps
- I could not read the Collabstr 2026 report itself. Its UGC figures and the 2025 usage-rights premium are second-hand.
- There is no methodology-backed source for:
  - YouTube Shorts rates above the nano tier;
  - Spark or whitelisting fees by duration;
  - extra-hook pricing;
  - 2025–2026 social media manager rates.
- IZEA has not published newer figures that I could reach.
- Billo's per-length payouts to creators are in an image I could not read.
- **Next step:** buy or request the Collabstr report PDF. After launch, use the workspace's own accepted-offer data to replace the seeds.

---

## 2. Standard deal terms in UGC and creator contracts

### Takeaway
Market practice settles on these terms:
- deliverables spelled out per line;
- 2 revision rounds, limited to the original brief;
- creator turnaround of about 5 days after the product arrives, and fixes within 48 hours;
- the brand prepays or pays on approval, with an auto-approval timer;
- usage priced by channel and duration;
- whitelisting granted in a separate clause;
- little or no exclusivity for UGC;
- the creator warrants they hold the rights to music and anyone appearing in the video;
- an explicit FTC disclosure duty.

Ownership splits two ways. Marketplaces (Billo) take a full assignment, while Insense and practitioners use a license, with the creator keeping copyright. Magpie needs a template that supports both, and it must never say "work made for hire".

### Findings

| Term | What the market does | Source |
|---|---|---|
| **Deliverables** | Line items with platform, count, length and aspect ratio. Hooks, raw files and photos are separate add-ons. | Billo add-ons [V-fetch]; TALENT.md brief schema |
| **Revisions** | **Billo:** "Two revisions within your brief" [V-fetch]. Reshoots only for "footage that misses the original brief", up to two per piece; a request "will delay the delivery time by 2-5 business days" [S, Billo help]. **Insense:** "Up to three content revisions" [V-fetch]. **Feedbird:** 2 revision rounds [V-fetch]. **Guides:** 1 to 2 rounds included, $25 to $75 per extra round [S]. | |
| **Turnaround** | **Billo creators:** "upload the content within 5 days after receiving the product" [S]; "submit a revised Deliverable within 2 days of a revision request" (creator terms §4.5) [V-fetch]. **Auto-approval:** "after 3 business days" for most brands, 5 to 10 days for larger ones [S, Billo help]. | |
| **Payment timing** | **Billo:** "Brands are charged upfront for each video" [V-fetch]. Creators get "Transfers ... within three (3) days of the Brand's approval" via Stripe Connect (creator terms §5.2) [V-fetch]. **Insense:** pays through the platform; rights are "automatically revoked until full payment is received" if a payment fails [S]. **Agencies and brands:** "60 to 90 days after invoicing" is typical (Billion Dollar Boy) [S]. Tipalti's 2023 survey found 56% of creators had been paid late (**older**) [S]. | |
| **Kill fees** | Staged by how far the work has gone. One guide: 25% before production, 50% after the first draft, 75% after revisions, 100% after final delivery. Another: 50% once work begins [S]. No measured data. | |
| **Usage scope and term** | Expiring windows by default, perpetual only as a priced buyout (§1.3). Insense: "full digital rights once the content is approved and the creator is compensated", perpetual, covering "all digital marketing channels" [V-fetch]. | |
| **Ownership** | **Billo:** "irrevocably assign and transfer to the Brand all rights, title, and interest ... worldwide", including the right to "edit, format, adapt, translate" (creator terms §7.1–7.2) [V-fetch]. **Insense:** creators keep "ownership & copyright, but they issue a license" [S]. **Law firm (Morgan Lewis, 2024-03-20):** define the company's license to "the influencer's content, image, voice, and likeness" [V-fetch]. | |
| **Moral rights** | Billo: "To the maximum extent allowed by law, you hereby agree to transfer or waive any moral rights" (§7.3) [V-fetch]. In the US, moral rights under VARA cover only works of visual art, not videos [P, not re-fetched]. Moral rights matter more for EU creators (§5.6). | |
| **Likeness** | Billo licenses "your image, name, voice, likeness, and any other personal attributes" (§7.2) [V-fetch]. | |
| **Exclusivity** | Law-firm advice is to define the scope narrowly [V-fetch, Morgan Lewis]. No percentages are published. Later says "longer windows and broader category definitions will cost more" [V-fetch]. | |
| **Whitelisting** | Needs its own explicit grant: "standard usage rights language does not cover it" [S, practitioner]. Insense includes Meta partnership-ad connections by plan and bills extra connections at $125 a month per 5 [V-fetch]. | |
| **Approval and takedown** | "final review and approval of all social media posts prior to being posted online"; the company can require takedowns [V-fetch, Morgan Lewis]. | |
| **Morals clause** | Termination "with cause" for conduct that harms the brand [V-fetch, Morgan Lewis]. Practitioners suggest making it mutual and narrow [S]. | |
| **FTC disclosure** | The influencer "should clearly and conspicuously disclose the influencer's connection with the company" [V-fetch, Morgan Lewis]. Billo §16.2: "You must clearly and conspicuously disclose your commercial relationship with the Brand" [V-fetch]. | |
| **Music and third-party content** | Creator warrants they have "obtained all necessary rights and permissions for every element in the Deliverables" (Billo §10.1) [V-fetch]. | |
| **Product seeding** | Products are sent; Insense lists seeding as unpaid [V-fetch]. Free product is a material connection that must be disclosed (16 CFR 255.5, Example 7) [V-fetch]. Billo's price excludes the product and its shipping [V-fetch]. | |
| **Minimum age** | Billo: "You must be at least 18 years old" (§3.1) [V-fetch]. | |
| **Union creators** | The SAG-AFTRA Influencer Agreement is signed by the creator's own company, so brands "do not need to worry if their influencers are union or nonunion" [S]. | |

### Inferences (Magpie template defaults; §7.2 lists them all)
- **Rights.** License by default. The paid-usage scope and term are set in the brief. The creator keeps portfolio rights, meaning they may show the work but not use it in paid ads. A buyout option uses a copyright assignment, never "work made for hire" (§3, §5.3).
- **Payment.** Every agreement must state a payment due date, because state law defaults to 30 days when none is given (§5.7). The brand prefunds at acceptance, and money is released on approval or by an auto-approval timer.
- **Revisions and timers.**
  - 2 revision rounds, limited to the brief.
  - Reshoots only when the brief was missed.
  - Creator fixes within 2 business days.
  - Brand review within 5 business days, then auto-approval.
- **Kill fee.**
  - 0% before the product ships or work starts.
  - 50% once the product is received or filming starts.
  - 100% of the creation fee once a draft that meets the brief is delivered.
  - Unused usage add-ons go back to the brand.

### Gaps
- There is no measured data on how often kill fees, exclusivity or whitelisting appear in contracts, or what they cost.
- I did not read the creator terms of Insense or other UGC marketplaces in full.
- There is no source on net-terms prevalence in 2025–2026.

---

## 3. E-signature APIs and whether click-to-accept is enough

### Takeaway
- **Build a native click-to-accept agreement for all v1 deals**, done properly:
  - a conspicuous notice and explicit wording that clicking means agreement;
  - an identity check through the creator's email magic link;
  - a stored PDF with its hash;
  - an audit record with time, IP address and browser;
  - a copy sent to both parties.
- **Add BoldSign as the optional formal e-signature provider for higher-risk deals.** It is the cheapest plan that includes embedded signing, starting at $30 a month (vendor pricing).
- **DocuSign and Dropbox Sign cost too much at this scale.** DocuSign puts embedded signing behind its custom-priced Enhanced plan. Dropbox Sign needs its Standard API plan.

### 3.1 Vendor comparison (prices fetched 2026-11-10; all vendor-stated)

| Vendor | Entry API price | Embedded signing | Notes |
|---|---|---|---|
| **BoldSign** ([pricing](https://boldsign.com/electronic-signature-pricing/)) | Enterprise API: "Starts at $30/month, includes 40 envelopes"; "Additional @ $0.75 per envelope" [V-fetch] | Yes: "Embedded requesting" and "Embedded signing" [V-fetch] | Free sandbox "no credit card required"; custom branding; 2 users (+$28 per user per month) [S]; ID verification $2 each [S] |
| **SignWell** ([API pricing](https://www.signwell.com/api-pricing/)) | "The first 25 API documents each month are free with a credit card on file"; then "starts at $0.85 per document and decreases with monthly volume, down to $0.20 per document" [V-fetch] | Yes: "Embedded Signing, Requests & Templates" [V-fetch] | One document can carry any number of files or signers; unlimited test usage; 10% off yearly. A $275-a-month base fee appears on a comparison page, not the pricing page [S] |
| **Documenso** ([pricing](https://documenso.com/pricing)), open source | Teams $40/month ($480/year): "API Access for Automation", "Embedded Signing". Platform $250/month: "Embedded Signing (Whitelabel)" [V-fetch] | Teams and Platform plans (hosted) | Self-hosted Community Edition is AGPL-3.0, and "Features in the EE folder are not licensed under AGPL3" [S, Documenso docs]. A "SaaS product using Documenso API only" can stay on Community [S]. Magpie itself is AGPLv3 (repo `LICENSE`), so self-hosting fits the license but adds operations work. |
| **PandaDoc** ([API pricing](https://www.pandadoc.com/api/pricing/)) | API Developer $40/month after a 14-day trial, 40 documents a month; Free plan 60 documents a year [V-fetch] | Offered ("white-label flow"), but the plan is not stated [V-fetch] | Has document editing and quotes, more than this module needs |
| **Dropbox Sign** ([API pricing](https://sign.dropbox.com/products/dropbox-sign-api/pricing)) | Essentials $75/month ($900/year), 50 requests; Standard $250/month billed yearly ($3,000), 100 requests [V-fetch] | **Standard and up.** Essentials sends signers to Dropbox Sign's hosted page [S]. Embedded templates need Premium, priced by quote [S]. | Free test mode |
| **DocuSign** ([developer plans](https://ecom.docusign.com/plans-and-pricing/developer)) | Starter $50/month ($600/year), 40 envelopes a month; Intermediate $300/month; Advanced $480/month [V-fetch] | **Only Enhanced**, priced by quote with a 5-user minimum [V-fetch] | Overkill for small creator deals |

### 3.2 Is a simple click-to-accept agreement legally enough?

- **The statute.** 15 U.S.C. §7001(a): an electronic record "may not be denied legal effect, validity, or enforceability solely because it is in electronic form" [V-fetch].
  - The consumer-disclosure regime in §7001(c) applies when a law "requires that information" be given to a *consumer* in writing [V-fetch]. A creator selling services is acting in business, so I read §7001(c) as not applying [P].
  - §7001(e): a record may be refused effect if it "is not in a form that is capable of being retained and accurately reproduced" [V-fetch]. So send and store a PDF.
- **Copyright transfers.** *Metropolitan Regional Information Systems v. American Home Realty Network*, 722 F.3d 591 (4th Cir. 2013): an electronic agreement can satisfy the signed-writing requirement for copyright transfers in 17 U.S.C. §204(a) [S]. A click-to-accept assignment of UGC rights is therefore workable.
- **Contract formation.** *Berman v. Freedom Financial Network*, 30 F.4th 849 (9th Cir. 2022): the notice must be "reasonably conspicuous", and assent counts only when the user "is explicitly advised that the act of clicking will constitute assent" [S, quoted in secondary sources]. *Oberstein v. Live Nation* (2023): clickwrap is "the clearest manifestations of assent" [S].
- **State freelancer laws need written, signed contracts.** Electronic ones count:
  - California's FWPA: give "a signed copy, either physically or electronically", and keep it "for at least four years" [V-fetch, 4A's summary].
  - Illinois requires these contents [V-fetch, IDOL]:
    - names and contact details of both parties;
    - an itemized list of products and services;
    - "Rate and method compensation";
    - "Date of compensation due";
    - the dates the services will be provided.
- **Where click-to-accept is weak** (my inferences):
  - Proving who clicked. The creator portal's magic link plus a check of the creator's email or phone answers this.
  - Digital-replica clauses. California Labor Code §927 (AB 2602, effective 2025-01-01) voids replica terms that lack a "reasonably specific description" when the person had no lawyer or union [S]. Keep replicas out of v1 templates.
  - Contracts with minors. Excluded in v1.
  - Large or perpetual buyouts, where a formal e-signature certificate helps in a dispute.

### Inferences
- **v1 method `clickwrap`** (already in TALENT.md §5), built as follows:
  - Render the agreement with Gotenberg.
  - Show the full text and the key terms in a summary box above the button.
  - Require a checkbox stating "I have read and agree to the Creator Agreement", a typed full legal name, and an "Agree and sign" button with the statement next to it.
  - Record the SHA-256 of the PDF, the time, IP address, user agent, the portal token and the template version.
  - Email the signed PDF to both parties. Keep it at least 4 years; matching the statute of limitations is better (New York's late-payment claims run 6 years [S]).
- **v1.1 method `esign` through an `ESignProvider` port.** BoldSign first, SignWell as the alternative. Use it when any of these applies:
  - total ≥ $5,000;
  - the rights grant is perpetual or an assignment;
  - exclusivity is over 30 days;
  - the customer requires it.

### Gaps
- I did not read the BoldSign or SignWell API terms on white-labeling, data residency, or how long they keep audit trails.
- The current status of *Berman* and *Oberstein* was not checked in the reporter.
- I did not check e-signature formalities for non-US creators, for example whether EU law needs a qualified signature for some grants.

---

## 4. Paying contractors and creators on customers' behalf

### Takeaway
- **Stripe Connect is the cleanest model for a small US-first SaaS.**
  - Magpie charges the customer's deal funds into its Stripe platform balance at offer acceptance, using separate charges and transfers.
  - Creators onboard as connected accounts. On Accounts v2 that means the recipient configuration with Stripe's Express Dashboard, and Stripe-hosted onboarding, KYC and tax-ID collection.
  - On owner or admin approval, Magpie transfers to the creator's account and Stripe pays out.
  - Stripe holds the licenses for the payout leg. Magpie must **not** fund payouts from its own bank account (top-ups) or use Global Payouts with customer money.
- **What Magpie takes on in exchange:**
  - liability for chargebacks and negative balances;
  - 1099 filing, at $2.99 per form through Stripe;
  - verified answers to a few questions for **Counsel** (TPSO status, state money-transmission exemptions, sales tax).
- **Two side doors:**
  - "Pay outside Magpie": the customer pays and files the 1099-NEC.
  - A partner that acts as vendor of record (Lumanu) for countries Stripe can't reach and for enterprise customers.

### 4.1 Funds-flow models compared

| Model | How money moves | Who files tax forms | Licensing exposure | Fit |
|---|---|---|---|---|
| **A. Platform marketplace (Stripe Connect, separate charges and transfers)** | Brand pays Magpie through Stripe (ACH debit or card). The money sits in Magpie's Stripe balance. On approval, a transfer goes to the creator's connected account, then a payout to their bank. | **Magpie**, because it controls pricing: "the platform is responsible for filing any relevant 1099 forms" [V-doc]. Which form depends on TPSO status (§4.4). | Stripe: "Connect payouts ... Stripe handles licensing requirements, and your platform isn't part of the payout funds flow" [V-doc] | **Recommended for v1** |
| **B. Creator as merchant (Connect direct charges, Stripe-handled pricing)** | Brand pays the creator's own Stripe account through Magpie's checkout or invoice. Magpie takes an application fee. | **Stripe** "issues 1099-K forms for connected accounts where Stripe controls the pricing" [V-doc] | Lowest. Stripe "covers loss liability for direct charges on connected accounts" [V-fetch] | Good fallback. Each creator needs a full merchant account; there is no prefunded escrow; a brand gets one charge per creator. |
| **C. Pay outside Magpie** | Customer pays from its own accounts payable (bank, Gusto, Melio, Deel). Magpie records "paid". | **Customer** files a 1099-NEC once a creator reaches $2,000 in 2026 (§4.4) | None for Magpie | Off-ramp for customers who already have accounts payable |
| **D. Partner as vendor of record (Lumanu for Platforms)** | Customer funds "separate, segregated accounts for each of your clients" at Lumanu, which "keeps your platform out of the flow of funds" [V-fetch, Vendor] | Lumanu: "Lumanu takes on the tax filing obligations, automatically managing W-9/W-8 collection and year-end 1099 filings" [V-fetch, Vendor] | Lumanu's | International creators and enterprise customers; partner deal needed |
| **E. Platform pays from its own bank account (Stripe Global Payouts, PayPal Payouts, Wise, Trolley balance)** | Magpie collects customer money and sends it out of its own balance | Magpie | Stripe: "If you manage your customers' funds, you might need a license such as an MTL" [V-doc] | **Avoid in v1** |

### 4.2 Stripe Connect facts (docs and pricing fetched 2026-11-10)

- **Pricing** ([Connect pricing](https://stripe.com/connect/pricing)) [V-fetch]
  - "You handle pricing" model:
    - $2 per monthly active account. An account is active "in any month when payouts go to its bank account or debit card".
    - Payouts cost 0.25% + 25¢ each.
    - Instant Payouts cost 1%.
    - Cross-border payouts start at 0.25%.
  - 1099 forms:
    - IRS e-file: $2.99 per form;
    - state e-file: $1.49 per form;
    - mailed copy: $2.99 per form.
  - "Stripe handles pricing" model: "No fees for your platform".
  - Card processing starts at 2.9% + 30¢. ACH Direct Debit is "0.8%, capped at $5.00" ([pricing](https://stripe.com/pricing)) [V-fetch].
- **Account model** ([connected account types](https://docs.stripe.com/connect/accounts)) [V-doc]
  - Standard, Express and Custom are now legacy: "Deprecated feature ... If you're setting up a new Connect platform, or your integration uses the Accounts v2 API, see the Interactive platform guide".
  - In Accounts v2, the `dashboard` value of `express`, `full` or `none` must be set "when you request the stripe_transfers feature for the Recipient configuration".
  - KYC: "In most configurations, Stripe is responsible for collecting KYC requirements"; the platform collects only when losses fall on the platform and `dashboard` is `none` ([configuration](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration)) [V-doc].
- **Liability.** For Express-type setups, fraud and dispute liability falls on the platform, and onboarding and identity collection is done by Stripe [V-doc, account types table]. With separate charges, "the platform is responsible for negative balances" [S].
- **Cross-border** ([cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts)) [V-doc]
  - "Platforms based in the US, UK, EEA, Canada, or Switzerland can transfer funds to connected accounts in any of those regions".
  - "Stripe doesn't support self-serve cross-border payouts to countries outside the listed regions."
  - "You can't make cross-border payouts to connected accounts under a recipient service agreement." Use Global Payouts for those.
  - Supported flows include "Separate charges and transfers without `on_behalf_of`".
  - A help article says platforms already approved for cross-border recipient accounts may keep using them [S].
- **Global Payouts** ([comparison](https://docs.stripe.com/connect/cross-border-payouts-to-recipients/compare-global-payouts)) [V-doc]
  - Its business fit is "Marketplaces that have the necessary Money Transmitter Licenses (MTLs)".
  - Payouts are funded "from your bank account, which is part of the flow of payout funds".
  - "Pay via email doesn't support cross-border payouts" [S].
- **Holding funds.** Stripe "does not support escrow accounts under the legal definition" but supports escrow-like manual transfers. A 90-day cap appears on a legacy page about manual payout schedules [S]. **Verify** how long a US platform may hold funds before transferring under separate charges and transfers.
- **Example cost of a $300 UGC deal under model A** (my arithmetic from the published rates):
  - Funded by ACH: ACH $2.40 + payout $1.00 + active-account fee $2.00 (if it is the creator's only payout that month) = **$5.40, or 1.8%**.
  - Funded by card: $9.00 + $1.00 + $2.00 = **$12.00, or 4.0%**.
  - Each year, a creator who meets a filing threshold adds $2.99 to $7.47 in forms.
  - For a $1,500 deal funded by ACH: $5.00 + $4.00 + $2.00 = $11.00, or 0.7%.

### 4.3 Other payout vendors (all vendor-stated unless marked)

| Vendor | Price | Tax features | Funds flow and licensing | v1 verdict |
|---|---|---|---|---|
| **Trolley** ([pricing](https://trolley.com/pricing/)) | Pay $2,399 a year; Tax $2,399 a year (one jurisdiction); domestic ACH $1.00; SEPA and similar $4.00; wire with FX $10.00; PayPal $0 plus PayPal's fees; Venmo $1.50; FX 2.00% [V-fetch] | Collects W-8, W-8BEN and W-9; validates tax IDs; generates 1099-K, NEC, MISC and 1042-S; DAC7 XML [S, Trolley pages] | "Trolley US Inc., a licensed money transmitter (NMLS ID: 2309944)"; deposits held at Cross River Bank [S]. The platform funds a Trolley balance, which puts Magpie in the flow of funds. | Later, if Magpie needs global payouts with full tax handling |
| **Tipalti** ([pricing](https://tipalti.com/approve/pricing)) | Mass Payments "starting at $249/month" plus transaction fees [S] | W-8 and W-9, 1099 and 1042-S (known product scope; not verified here) | Platform funds payouts | Too heavy for v1 |
| **PayPal Payouts** ([fees](https://www.paypal.com/us/business/paypal-business-fees), updated 2026-11-04) | Domestic "2% of total transaction amount", capped at $1.00; through the API, a flat $0.25; international 2%, capped at $20.00 [V-fetch] | None found | Platform funds its PayPal balance | Not v1 |
| **Wise** (Business batch payments / Platform) | Batch tool and API "free"; per-transfer fees "from 0.24%" [S] | None found | Platform's own funds; Wise Platform is for banks and large fintechs | Not v1 |
| **Deel** ([pricing](https://www.deel.com/pricing/)) | Contractors "$49 per contractor per month"; Contractor of Record "$325 per contractor of record per month", which can "shift liability to Deel" [V-fetch] | "Tax form guidance & document collection" [V-fetch]; 1099 filing not stated | Customer pays Deel | For the **customer's** repeat freelancers when classification risk is high (§5.3) |
| **Ontop** ([pricing](https://www.getontop.com/pricing)) | Contractor of record "Starting from $49/month" [V-fetch] | Mentions contractor tax documentation | Customer pays Ontop | Alternative to Deel for Latin American talent |
| **Lumanu** ([pricing](https://lumanu.com/pricing), [platforms](https://lumanu.com/solutions/platforms)) | No published rates; "Lumanu charges a low transaction fee, similar to a credit card". Platforms: "Flexible revenue share or wholesale pricing". A partner discloses "a 3.5% fee on deposits" [S, Superfiliate help]. | "W8/W9/1099 for US and VAT/GST/WHT globally"; "Lumanu takes on the tax filing obligations" [V-fetch] | Segregated client accounts; platform kept out of the flow of funds [V-fetch] | **Evaluate for v1.1** (international, enterprise) |

### 4.4 Tax forms: who collects W-9 or W-8BEN and who files

- **Thresholds for 2026**
  - IRS: "For payments made after December 31, 2025, the reporting threshold for Form 1099-MISC or Form 1099-NEC is met if the amount of payments to a recipient total $2,000 or more", indexed for inflation from 2027 [S, IRS].
  - Form 1099-K: TPSOs (third-party settlement organizations, the payment networks that settle payments to sellers) file only if "the gross amount of reportable payment transactions to a payee exceeds $20,000" and "the number of transactions exceeds 200" [V-fetch, [IRS FAQ](https://www.irs.gov/newsroom/form-1099-k-faqs-third-party-filers-of-form-1099-k), reviewed 2026-05-18].
  - Stripe's table agrees: 1099-K for 2025 and 2026 is "More than 20,000 USD in total gross volume and more than 200 transactions", and 1099-NEC/MISC for 2026 is "2,000 USD or more in payments" [V-fetch].
- **No double reporting.** IRS FAQ Q11: if a payment is reportable under both §6041/6041A and §6050W, "the transaction should only be reported on Form 1099-K" [V-fetch].
  - The 1099-MISC/NEC instructions: card and third-party network payments "must be reported on Form 1099-K by the payment settlement entity under section 6050W and are not subject to reporting on Form 1099-MISC or Form 1099-NEC" [S, draft Rev. Dec 2026; the same wording appears in prior years].
  - **Consequence:** customers who pay creators by card, or through a TPSO, do not file 1099-NECs for those payments.
- **States with lower 1099-K thresholds** ([Stripe 2026 table](https://docs.stripe.com/connect/1099-k)) [V-doc]:

  | Threshold | States |
  |---|---|
  | $600 | DC, Maryland, Massachusetts, Montana, Vermont, Virginia |
  | $1,000 | New Jersey |
  | $1,000 and 4 transactions | Illinois |
  | $2,500 | Arkansas |

  Several states require a form only where state tax was withheld.
- **Who files under each model**
  - Model A: "For all other transactions where the platform controls the pricing, the platform is responsible for filing any relevant 1099 forms" [V-doc, [Stripe tax reporting](https://docs.stripe.com/connect/tax-reporting)]. Stripe supports 1099-NEC, MISC and K.
  - Stripe's support page: for Express accounts, "The platform is responsible for filing and delivering 1099 forms" [V-fetch].
  - Deadlines: Stripe recommends filing by January 22, 2027. Forms must reach recipients by February 1 [V-doc].
  - **Counsel:** whether Magpie is a TPSO that files 1099-Ks under the $20,000/200 rule, or a payer that files 1099-NECs at $2,000, depends on whether Magpie's network counts as a "third party payment network". Marketplaces such as Upwork and Fiverr report on 1099-K; I did not verify that here.
- **Collecting tax IDs**
  - The payer, or the TPSO for 1099-K, must hold a certified tax ID.
  - Backup withholding is 24% "from reportable payments of nonemployee compensation to U.S. persons when the payee hasn't provided a TIN" [S, IRS]. If a W-9 is not returned within 30 days, withholding starts [S].
  - Under model A, Stripe's hosted onboarding collects the tax ID. I did not confirm whether Stripe supports backup withholding (gap).
- **Foreign creators**
  - A W-8BEN "establishes foreign status and claims treaty benefits" [S, IRS].
  - Pay for services performed outside the US is foreign-source income, so there is no US withholding [S, IRS Pub. 515].
  - **Counsel:** a license to use content in the US may be a US-source *royalty*, which carries 30% withholding unless a treaty applies and is reported on Form 1042-S. Pub. 515 lists royalties separately from personal services [S].
  - v1 should keep non-US creators out of Magpie-run payouts, or send them to Trolley or Lumanu, which collect W-8 forms and file 1042-S.
- **Gifted products.** A product given in exchange for content is compensation [P]. Whether its value must be reported is a **Counsel** question; I did not research it.

### 4.5 Money transmission

- **FinCEN payment-processor exemption** ([FIN-2014-R009](https://www.fincen.gov/sites/default/files/administrative_ruling/FIN-2014-R009.pdf), issued 2014-08-27, **older but current guidance**). It has four conditions [V-doc]:
  - "(a) the entity providing the service must facilitate the purchase of goods or services, or the payment of bills for goods or services (other than money transmission itself);"
  - "(b) the entity must operate through clearance and settlement systems that admit only BSA-regulated financial institutions;"
  - "(c) the entity must provide the service pursuant to a formal agreement; and"
  - "(d) the entity's agreement must be at a minimum with the seller or creditor that provided the goods or services and receives the funds."
- **States.** California's agent-of-payee exemption (Fin. Code §2010(l)) covers an agent under "a preexisting written contract" where paying the agent satisfies the payor's obligation to the payee [S, DFPI and Cooley 2021]. Other states differ [S].
- **Stripe's position:** Connect payouts are "Covered by Stripe's licensing", while Global Payouts may require "a license such as an MTL" [V-doc].

### Inferences
- **v1: model A, US creators only.**
  - Accounts v2 with the recipient configuration, `dashboard: express`, and `losses_collector` and `fees_collector` both set to `application`.
  - Separate charges and transfers. ACH Direct Debit by default, card allowed.
  - Fund the deal when the creator accepts the offer. Wait until the funds settle before the creator starts or the product ships.
  - Transfer on owner or admin approval (ruling T2), then pay out on Stripe's standard schedule.
  - File 1099s with Stripe's 1099 product.
- **Put an agent-of-payee clause in the creator terms.** The creator appoints Magpie and Stripe as limited payment-collection agents, so the brand's payment to Magpie discharges the brand's debt to the creator. Also put an agreement with both parties in place. Together these fit FinCEN condition (d) and Cal. Fin. Code §2010(l). **Counsel** must confirm the 50-state picture.
- **Add UK, EEA, Canada and Switzerland creators later** through Connect cross-border payouts on the full service agreement. Elsewhere, use Lumanu or Trolley, not Global Payouts.
- **Offer "Pay outside Magpie"** (model C) from day one. It keeps agencies that already run accounts payable, and keeps Magpie out of their money.
- **Pricing for §11.** A brand-side "payments fee" of about 5% (minimum $3) covers Stripe's 1.8% to 4.0% plus forms and chargeback risk. For comparison:
  - Insense marketplace fee 7% to 20% [V-fetch];
  - Lumanu 3.5% (one partner) [S];
  - Upwork 5% client fee [S];
  - Influee 10% [S].

### Gaps (Counsel and verification)
- Whether Magpie is a TPSO (1099-K) or a payer (1099-NEC).
- Backup-withholding support in Stripe.
- Whether Magpie becomes the merchant of record with sales-tax exposure on content services (**not researched**).
- The 50-state money-transmission exemptions.
- Holding limits under separate charges and transfers.
- Whether Accounts v2 "recipient configuration" is the same thing as the "recipient service agreement" for cross-border purposes.
- Lumanu's actual platform pricing.

---

## 5. Compliance

### Takeaway
Five obligations come out of this section. Each maps to a Content Reviewer check or a code guardrail (§7.4):
- disclosure on every post, using the platform's label **and** in-content wording;
- real product use before any testimonial;
- no unsubstantiated claims;
- 18 or older only;
- no "work made for hire".

Worker classification is a risk mainly for *repeat* freelancers, such as monthly social media managers and retainer editors. Hand those to the customer's employer-of-record or contractor-of-record tool when risk signals add up.

### 5.1 FTC Endorsement Guides (16 CFR 255, revised 2023) and the Consumer Reviews and Testimonials Rule (16 CFR 465)

- **Endorsement Guides** ([255.1](https://www.law.cornell.edu/cfr/text/16/255.1), [255.5](https://www.law.cornell.edu/cfr/text/16/255.5)) [V-fetch]
  - Honest opinion: "Endorsements must reflect the honest opinions, findings, beliefs, or experience of the endorser" (255.1(a)).
  - Bona fide user: when an ad says the endorser uses the product, "the endorser must have been a bona fide user of it at the time the endorsement was given" (255.1(c)).
  - Advertiser liability: "Advertisers are subject to liability for misleading or unsubstantiated statements made through endorsements" (255.1(d)). Advertisers should guide and monitor endorsers, though good-faith efforts are not a safe harbor.
  - Material connections: "such connection must be disclosed clearly and conspicuously" when "not reasonably expected by the audience"; "They can include monetary payment or the provision of free or discounted products" (255.5).
  - Monitoring: the advertiser should "have reasonable procedures in place to monitor the influencer's postings for compliance" (255.5, Example 7).
- **FTC "Disclosures 101"** ([page](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers), November 2019, **older but current**) [V-fetch]
  - In video, "the disclosure should be in the video and not just in the description".
  - Acceptable words: "advertisement", "ad", "sponsored". Avoid "sp", "spon" and "collab".
  - "Don't assume that a platform's disclosure tool is good enough", and "consider using it in addition to your own".
  - Live streams: "repeated periodically".
- **Consumer Reviews and Testimonials Rule** (16 CFR 465, effective 2024-10-21) [V-fetch from [LII](https://www.law.cornell.edu/cfr/text/16/465.1)]
  - A "consumer testimonial" is "an advertising or promotional message ... that consumers are likely to believe reflects the opinions, beliefs, or experiences of a consumer who has purchased, used, or otherwise had experience with a product".
  - §465.2(b) bars a business from disseminating a consumer or celebrity testimonial about itself when it knew or should have known that the testimonial misrepresented that the person exists, used the product, or what their experience was [V-fetch summary of 465.2].
  - The rule reaches AI-generated testimonials from people who do not exist [S, Sidley and Mintz 2024].
  - "Indicators of social media influence" covers followers, views and likes, and buying fake ones is barred (465.8) [V-fetch].
- **Enforcement**
  - December 2025: FTC staff sent warning letters to about ten companies, "the FTC's first public use of the Rule as an enforcement tool" [V-fetch, [Benesch, 2026-04-06](https://www.beneschlaw.com/insight/five-stars-zero-tolerance-ftc-turns-up-enforcement-under-consumer-review-rule/)].
  - Penalties reach "$53,088 per violation" [V-fetch]. The FTC made no inflation adjustment for 2026 [S, Federal Register].
  - I found no filed case under Part 465 as of 2026-11-10.
  - Private class actions over undisclosed influencer posts were reported in 2026 (Kelley Drye snapshot dated 2026-06-18), but I could not read the details [S].

### 5.2 Platform branded-content tools

- **TikTok** [S, TikTok's Branded Content Policy and help]
  - "When posting branded content, you must enable the commercial content disclosure toggle."
  - Posts are labeled "Paid partnership" when made for another business. The label "can't be changed" after posting.
  - Undisclosed commercial content "may not be eligible for distribution in the For You feed".
  - Business accounts may use only the Commercial Music Library (§5.5).
  - TikTok One requires "You must be at least 18 years old" [S, TikTok help].
- **Instagram and Facebook** [S, Meta help]
  - "Our branded content policies require that you use the paid partnership label to tag the brand you are working with."
  - Free or loaned products and affiliate commissions count as "an exchange of value".
  - Some categories need Meta's written pre-approval: gambling, pharmacies, crypto, politics and others.
  - Partnership-ad permissions can be revoked by the creator at any time.
- **Implication.** Use the platform label **plus** in-content wording, because the FTC says platform tools may not be enough.

### 5.3 Worker classification for repeat freelancers

- **IRS common-law test** [S, IRS Topic 762 and Pub. 15-A]
  - The question is whether the business has "the right to control the details of a worker's performance".
  - Evidence falls into three groups: "behavioral control, financial control, and relationship of the parties".
  - Financial factors include unreimbursed expenses, the worker's investment, offering services to the market, how they are paid, and whether they can make a profit or loss.
  - Relationship factors include contracts, benefits, permanency, and whether the work is "a key aspect of the regular business".
- **US Department of Labor (Fair Labor Standards Act)**
  - The 2024 rule took effect 2024-03-11. The DOL said in May 2025 that it would stop enforcing it.
  - An NPRM published 2026-02-27 would bring back a 2021-style "core factor" test, which weights control and opportunity for profit or loss most.
  - The DOL's agenda targeted a final rule for October 2026. **I found no published final rule as of 2026-11-10** [S]. Until one exists, advisories treat the 2024 rule as the text in force.
- **California AB5 (ABC test, Labor Code §2775)** with the professional-services exemption in §2778 ([text](https://california.public.law/codes/labor_code_section_2778)) [V-fetch]
  - The exemption has six conditions:
    - "maintains a business location ... separate from the hiring entity";
    - holds a business license where required;
    - "ability to set or negotiate their own rates";
    - "ability to set the individual's own hours";
    - "customarily engaged in the same type of work performed under contract with another hiring entity";
    - "customarily and regularly exercises discretion and independent judgment".
  - Covered services include:
    - "marketing, provided that the contracted work is original and creative in character";
    - "Graphic design";
    - "a still photographer, photojournalist, videographer, or photo editor who works under a written contract";
    - "a freelance writer, translator, editor, copy editor, illustrator".
  - The text does not mention social media or UGC creators by name.
- **California work-made-for-hire trap**
  - Labor Code §3351.5(c) covers "Any person while engaged by contract for the creation of a specially ordered or commissioned work of authorship" where the parties "expressly agree in a written instrument signed by them that the work shall be considered a work made for hire" [V-fetch].
  - UI Code §686: "The ordering or commissioning party shall be the employer of the author of the work for the purposes of this part" [V-fetch, via [Farella Braun, 2021-04-29](https://www.fbm.com/employment/publications/employment-law-issues-to-consider-before-including-work-made-for-hire-clauses-in-contractor-agreements/)].
  - Farella calls assignment "the employer's best option" [V-fetch].
- **Inferences.** Signals of employee-like risk for a repeat freelancer:
  - fixed hours or a fixed schedule;
  - more than about 6 months of continuous monthly work;
  - hourly pay with no deliverable scope;
  - the brand's own tools, logins and training;
  - the brand approving every step;
  - exclusivity.

  UGC creators paid per deliverable through a written contract, who set their own rates and work for many brands, are low risk. California professional-services status for them is plausible but unconfirmed. When the signals stack up, the Bots should suggest Deel's Contractor of Record ($325 a month) or employing the person.

### 5.4 Hiring minors

- **COPPA** ([amended rule](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches)): effective 2025-06-23, with full compliance due 2026-04-22 [S]. It applies to operators collecting personal information from children under 13. Magpie stays out of scope by refusing anyone under 18 and never collecting children's information on purpose.
- **California**
  - AB 1880 extends the Coogan law to child "content creators". "Marketers and those hiring child influencers directly will need to implement policies to verify" Coogan trust accounts and pay 15% into them.
  - SB 764: creators who feature minors in at least 30% of their content must deposit 65% of the minor's gross earnings in trust. Both took effect 2025-01-01 [V-fetch, [Davis+Gilbert, 2024-11-21](https://www.dglaw.com/californias-new-laws-will-change-the-way-marketers-engage-child-influencers/)].
- **Illinois** (effective 2024-07-01): trust set-asides for children 16 and under who appear in at least 30% of compensated vlogs. Sources conflict on the percentage [S].
- **Minnesota** (2024 c.103, effective 2025-07-01): "a minor under the age of 14" may not engage "in the work of content creation", and a featured minor is owed proceeds [S, revisor.mn.gov].
- **Utah HB 322 (2025):** trust requirement with conflicting reported thresholds ($20,000, $40,000 or $150,000) and an effective date of about May 2025 [S]. **Unconfirmed.**
- **Implication.** Keep T4 (18 or older only). Extend it to "no minors appearing in deliverables" unless the customer's counsel approves. Family creators who feature their children trigger the California, Illinois, Minnesota and Utah duties.

### 5.5 Music, likeness and AI replicas in UGC

- **Music.** TikTok business accounts see only the Commercial Music Library. Branded content must use music from it, and "It's ultimately the brand's responsibility to obtain any necessary copyright" [S, Soundstripe and press; TikTok's own terms not fetched]. The Content Reviewer already flags commercial music for a person (TALENT.md §7).
- **Likeness.**
  - New York Civil Rights Law §§50–51 requires written consent to use a living person's name, portrait, picture or voice in advertising [P, not re-fetched].
  - California Civil Code §3344 requires consent and sets minimum damages [P, not re-fetched].
  - The agreement's likeness license covers the creator. Anyone else in the frame needs a release, and minors need a guardian's release.
- **AI replicas.** California Labor Code §927 (AB 2602, effective 2025-01-01) makes a digital-replica provision unenforceable when all of these apply [S, law-firm summaries]:
  - it replaces work the person would have done;
  - it lacks a "reasonably specific description" of the uses;
  - the person had no lawyer or union.

  If customers want AI voice clones or avatar variants of a creator, that needs its own clause and pricing. **Keep it out of v1.**

### 5.6 EU creators: GDPR and DAC7

- **GDPR** [P, my reading; not researched in depth]
  - Lawful basis: performing the contract (Art. 6(1)(b)), plus legal obligation for tax records (Art. 6(1)(c)).
  - An Art. 13 privacy notice is due at collection.
  - A non-EU company targeting EU creators may need an Art. 27 EU representative.
  - The customer is the controller of the creator's data for its campaign. Magpie is the customer's processor and the controller of its own portal accounts. Put Art. 28 terms in the customer agreement.
- **Transfers to the US.** The EU–US Data Privacy Framework survived *Latombe v Commission* in the EU General Court on 2025-09-03. An appeal to the Court of Justice was filed 2025-10-31 [S].
- **Moral rights and assignment.** EU moral rights cannot be waived in several countries, and German law does not allow transferring copyright itself, only exclusive licenses [P, not re-fetched]. For EU creators, use exclusive licenses and a "waive or not assert" clause.
- **DAC7.** EU platform reporting covers "personal services" with **no** de minimis threshold; the 30-sales, €2,000 exclusion applies only to sellers of goods. Platforms outside the EU that serve EU-resident sellers must register in a member state [S, secondary guides]. **Counsel:** if Magpie sources EU creators and handles their payment, it may be a reporting platform operator. Trolley says it generates the DAC7 XML [S]. **v1: no EU creators paid through Magpie.**

### 5.7 State freelancer payment laws (they set the maximum payment term)

| Law | Covers | Requirements | Source |
|---|---|---|---|
| California SB 988, Freelance Worker Protection Act, effective 2025-01-01 | Professional services under Labor Code §2778 (marketing, graphic design, photography, videography and more) for $250 or more | Written contract; signed copy (paper or electronic); keep 4 years; pay by the contract date or "within thirty days after the work is completed" | [V-fetch, [4A's](https://www.aaaa.org/blog/new-california-freelancer-law-takes-effect-on-january-1-2025/)] |
| Illinois Freelance Worker Protection Act, effective 2024-07-01 | $500 or more within 120 days | Written contract with set elements; pay "within 30 days of completing the services" if no date is given | [V-fetch, [IDOL](https://labor.illinois.gov/laws-rules/legal/freelance-worker-protection-act)] |
| New York State Freelance Isn't Free Act, effective 2024-08-28 (one source says 2024-05-20) | $800 or more, counting the prior 120 days with the same client | Written contract; pay within 30 days of completion if silent. Remedies include double damages; 6-year limitation | [S, JD Supra and others] |

New York City has had its own Freelance Isn't Free law since 2017 [S].

### Gaps
- No primary text fetched for Utah HB 322, Illinois SB 1782's percentages, or the TikTok Commercial Music Library terms.
- Whether a UGC ad run from the *brand's* handle needs a "paid" disclosure in the ad itself. Part 255.5 turns on audience expectation. My inference is to add "Paid partner" text on screen when the creator appears to be an ordinary customer. **Counsel.**
- AB5 applied to UGC creators specifically.
- GDPR scope under Art. 3(2), and whether an Art. 27 representative is needed.

---

## 6. How done-for-you agencies and UGC agencies structure creator pay and QC (public information only)

### Takeaway
- **Done-for-you shops (Feedbird)** sell cheap fixed-price monthly plans. They make the content with an offshore team paid **monthly**, hired after skill tests and a paid trial. Quality comes from:
  - an approved content calendar;
  - 2 revision rounds;
  - a senior lead on higher tiers.
- **UGC marketplaces (Billo, Insense)**:
  - pay **per approved video** from money the brand prefunded;
  - cap revisions;
  - auto-approve when brands go quiet;
  - rank creators by ratings and on-time delivery.

### Findings
- **Feedbird** ([pricing](https://www.feedbird.com/pricing), fetched 2026-11-10) [V-fetch]
  - Plans:
    - "Social Media Posts from $99/mo", 10 posts;
    - "Short-Form Videos from $149/mo", 5 videos of 20 to 60 seconds, "Edited from your footage or premium stock";
    - AI Videos from $149/mo for 2 videos;
    - Feedbird Pro $1,500/mo with "a dedicated senior lead".
  - Who makes it: "Team of 200+ vetted creatives, not AI".
  - Quality and refunds: 14-day guarantee covering "2 revision rounds"; the client approves a calendar.
  - Hiring: a video-editor listing names Feedbird and pays "Part-time - 600-800$ Full-time - 1200-1400$" a month. The process is "a small editing test, then a 20-minute test, then 2-week paid testing, training & onboarding process". The location is listed as South Africa [S, weekday.works; salary field garbled].
  - Inference: at $149 for 5 videos, a full-time editor at about $1,300 a month breaks even near 45 videos a month at client prices. So the margin depends on high throughput per editor and on templates and AI assistance. This is my arithmetic, not a published figure.
- **Billo** ([help](https://help.billo.app/en/articles/6230554-for-creators-becoming-a-premium-creator), creator terms effective 2026-10-01)
  - Brands buy credit packs upfront: $1,000, $2,500 (+$300 bonus) or $5,000 (+$700 bonus). Balances are valid 12 months [V-fetch].
  - Premium creator criteria: "Get 14 videos approved by brands", "Have at least 5 videos rated", "average rating of 4.8 or higher", "on-time delivery score of 90% or more" [V-fetch].
  - Payout through Stripe "within 3 days" of approval, then Stripe sends weekly. Creators in the US, Canada and the UK are paid through Stripe [V-fetch].
  - Brands may request reshoots only when the brief was missed. Auto-approval after 3 business days. Creators "aren't penalized" for a brand's delay [S].
  - Billo may "withhold payment for the disputed Deliverable" if a revision is not done on time [S].
- **Insense** ([pricing](https://insense.pro/pricing)) [V-fetch]
  - Subscription: Trial from $650 for one month; Brand $400 to $500 a month; Agency $640 to $800 a month.
  - Marketplace fee: 20% on Trial, 10% on Brand, 7% on Agency, "covers the 5-10% Payment Facilitation Fee, and the 5-10% Service Fee", plus a separate transaction fee.
  - Up to 3 revisions. Refund "If fewer than 5 matching applicants apply".
  - Contracts and payments run in the platform. Rights are licensed, and revoked if payment fails [S].
- **Other comparisons** [S, vendor-authored]
  - Trend: packages from about $500 a month.
  - Influee: 10% fee on top of creator pay, and a 14-day review window.

### Gaps
- No public data on creator approval or rejection rates, or on QC staffing ratios.
- Feedbird's careers page was not fetched directly.
- No figures on how Feedbird-style shops split AI from human editing.

---

## 7. Recommended v1 defaults

### 7.1 Default rate card (seed for `rate_benchmarks`, `as_of = 2026-11-10`, US, creator fee in USD)

Every row is my synthesis of the sources named. The Bots should show the source line next to any proposed rate and prefer the workspace's own accepted-offer history once it has 10 or more data points for that kind of work.

**UGC video**: creator fee, edited, 1 hook, 2 revisions, organic use on the brand's channels, no paid ads.

| Item | p25 | p50 | p75 | Unit | Basis |
|---|---|---|---|---|---|
| UGC video, 30 seconds | $100 | $150 | $250 | per video | Collabstr $154 paid / $180 asked [S]; Pitchlo $100 median, IQR $50–$200 [S]; Fiverr $117–$155 [S]; Billo $139 brand price for 30 s [S]; Insense from $100 [V-fetch] |
| Length multiplier | ×0.75 at 15 s | ×1.0 at 30 s | ×1.25 at 60 s; ×1.5 at 90–120 s | multiplier | Billo ladder $99, $139, $169 [S]; 90–120 s extrapolated |
| Extra hook (new first 3–5 s) | $30 | $50 | $75 | per hook | Guides: $50 each, $50–$100 per variation; editors $40–$80 [S] |
| Full variation (new script or angle) | 50% | 60% | 75% | of base | Inference from hook pricing |
| Raw files delivered with the edit | $25 | $50 | $100 | flat | Guides $50–$100+, or +30% to 50% [S] |
| Raw only (brand edits) | ×0.7 | ×0.75 | ×0.8 | of edited | Billo +$65 editing on $139 [S] |
| 4 photos | $30 | $40 | $60 | add-on | Billo creator add-on payout $40 [V-fetch] |
| Rush (under 5 business days) | +25% | +25% | +50% | of base | Guides +25% to 50%; Later: rush under 2 weeks [S/V-fetch] |
| Extra revision round (beyond 2) | $25 | $50 | $75 | per round | Guides [S] |

**Paid usage and whitelisting**: percentage of the creation fee.

| Item | Default | Range | Basis |
|---|---|---|---|
| Paid ads from the brand's handle, 30 days | +25% | +20% to 35% | Net Influencer panel [V-fetch]; Later +30% to 50% [V-fetch] |
| Paid ads, 90 days | +50% | +40% to 75% | Interpolated |
| Paid ads, 12 months | +100% | +75% to 150% | Panel: Peach 75% to 150%, Albert +1.5x [V-fetch] |
| Perpetual buyout: UGC creator | ×2.0 total | ×1.5 to 3 | Marketplaces bundle at about 1x (Billo, Insense); panel minimum 2x to 3x |
| Perpetual buyout: influencer content | ×3.0 total | ×3 to 5 | Panel [V-fetch] |
| Whitelisting or Spark code from the creator's handle | +25% per 30 days, minimum $50 | 20% to 30% per 30 days | Guides [S]; Insense cheatsheet $100–$150/month [S]. Prepay discount: 90 days −10% [S] |
| Category exclusivity | none by default; +10% per 30 days for UGC, +20% per 30 days for influencers, 90 days maximum | — | No data; inference |

**Influencer post**: one organic post on the creator's channel, kept live 30 days or more, paid usage extra. Nano is 1K–10K followers, micro 10K–100K, mid 100K–500K.

| Platform | Nano p25 / p50 / p75 | Micro p25 / p50 / p75 | Mid p25 / p50 / p75 | Basis |
|---|---|---|---|---|
| TikTok video | $75 / $150 / $300 | $250 / $500 / $1,000 | $1,000 / $2,000 / $4,000 | Collabstr average $186 [S]; IMH nano $50–$200, micro $200–$800, 100K–1M $800–$5,000; Later micro $800–$2,500; Elev8or micro $213–$1,275 [V-fetch] |
| Instagram Reel | $100 / $175 / $350 | $300 / $600 / $1,200 | $1,200 / $2,500 / $5,000 | Collabstr average $193, Reels about 32% above TikTok [S]; IMH, Later and Elev8or bands [V-fetch] |
| YouTube Short (**low confidence**) | $50 / $100 / $200 | $200 / $400 / $800 | $800 / $1,500 / $3,000 | IMH Shorts nano $20–$100 [V-fetch]; blogs micro $100–$2,000, "40–60% below TikTok" [S] |

Guardrail: compute the offer's effective cost per 1,000 of the creator's median recent views, and flag outliers against the workspace's history. There is no public benchmark to seed this.

**Freelancers**: independent contractors in the US. For offshore talent, multiply by about 0.3 to 0.5, inferred from Upwork's Philippines profiles at $4–$15 an hour [S] and Feedbird's editor pay [S].

| Role | Unit | p25 | p50 | p75 | Basis |
|---|---|---|---|---|---|
| Social media manager | hour | $30 | $50 | $75 | Upwork $14–$35 global [S]; HeyOrca 2024 about $67 [S]; goLance $60–$110 for experienced [S] |
| Social media manager, 1 brand, 3 platforms, 12–20 posts a month | month | $1,000 | $2,000 | $3,000 | HeyOrca $2,107 [S, 2024]; SoloHourly $2,250 [S] |
| Short-form video editor | hour | $25 | $40 | $65 | Upwork median $35, mid tier $40 [S]; BLS employee median $36.26 [V-fetch, derived] |
| Short-form edit (30–60 s, captions, b-roll, licensed music, from supplied footage) | video | $35 | $60 | $120 | Upwork gigs $15–$240, typically $20–$80 [S]; Feedbird client price about $30 [V-fetch] |
| Graphic designer | hour | $25 | $40 | $65 | Upwork median $25 [S]; BLS employee median $30.27 [V-fetch] |
| Static social post design | post | $25 | $50 | $100 | Inference: 1–2 hours × hourly rate; Feedbird about $10/post at offshore scale |
| Carousel, 5–10 slides | carousel | $75 | $150 | $300 | Inference: 3–5 hours |

### 7.2 Agreement template defaults (offer terms in `talent_offers.terms`)

| Term | Default | Why |
|---|---|---|
| Parties | Customer (brand or agency) and creator. Magpie is not a party except as limited payment agent under its platform terms. | Agent-of-payee structure (§4.5) |
| Deliverables | Line items from the brief: platform, count, length, aspect ratio, hooks, raw files, photos | §2 |
| Revisions | 2 rounds limited to the brief. A reshoot only if the brief was missed. Extra rounds at the rate card price. | Billo, Feedbird, Insense practice |
| Turnaround | Draft within 7 days of the product arriving (5 for UGC from marketplace creators), fixes within 2 business days, brand review within 5 business days, **then auto-approval** | Billo 5 days, 2 days, 3 business days [S/V-fetch] |
| Payment | Brand prefunds 100% at acceptance. Deals ≥ $1,000 and influencer posts: 50% released when the creator finishes onboarding and confirms the start, 50% on approval or go-live. Creator paid within 3 business days of approval. Due date written into the contract, never more than 30 days after completion. | CA, IL and NY laws (§5.7); Billo 3 days |
| Kill fee | 0% before the product ships or work starts; 50% after the product is received or filming starts; 100% of the creation fee after a draft that meets the brief is delivered. Usage add-ons refunded. | Staged practice [S]; inference |
| Rights | **License**: perpetual organic use on the brand's channels, plus paid usage for the term and channels in the brief. The creator keeps copyright and portfolio rights. **Buyout option**: assignment. Never "work made for hire". | §2, §5.3; Billo assigns, Insense licenses |
| Whitelisting or Spark | Off by default. When on: platform, duration (7, 30, 60, 180 or 365 days to match TikTok's options), fee, and the creator's right to revoke after the term. | §1.3 |
| Exclusivity | None by default | No data supports routine exclusivity for UGC |
| Moral rights | Waived where the law allows, otherwise a covenant not to assert | Billo §7.3 |
| Likeness | Name, voice and likeness only as they appear in the deliverables, for the rights term. **No AI replica or voice clone.** | Cal. Labor Code §927 |
| Honest use | Creator receives and uses the product before any testimonial content. No claims beyond the brief. No invented results. Brand supplies substantiation for claims. | 255.1(a), (c), (d); 465.2 |
| Disclosure | Platform label (TikTok commercial content toggle; Instagram paid partnership) **plus** "ad", "sponsored" or "paid partnership" in the video or caption. Never "sp", "spon" or "collab". Repeat it in live streams. | FTC Disclosures 101; TikTok and Meta policies |
| Music and third parties | Commercial Music Library or brand-supplied licensed tracks only. Releases for anyone else in the frame. No other brands' logos. | §5.5 |
| Independent contractor | Creator controls how the work is done, uses their own equipment, sets their own hours, may work for others | §5.3 |
| Age | Creator represents they are 18 or older. No minors appear in deliverables. | T4, §5.4 |
| Taxes | Tax ID collected through the payout provider. Backup withholding as the law requires. | §4.4 |
| Termination and morals | Mutual and narrow; pay for accepted work | Morgan Lewis [V-fetch] |
| Records | Signed PDF and audit trail kept at least 4 years | California FWPA |

### 7.3 Recommended contracts-and-payouts stack for v1

1. **Agreements: native click-to-accept agreement** (`method = 'clickwrap'`)
   - Gotenberg PDF, portal magic-link identity, explicit-assent button, PDF hash, time, IP and browser recorded, copy emailed to both parties, kept 4 years or more.
   - Cost: none beyond infrastructure.
   - **Next:** a BoldSign Enterprise API adapter (`method = 'esign'`) behind an `ESignProvider` port, at $30/month including 40 envelopes and $0.75 each after, with embedded signing and a free sandbox (vendor-stated). Use it for deals ≥ $5,000, buyouts, exclusivity over 30 days, or on customer request. SignWell is the fallback (25 free documents a month, then $0.85 to $0.20). Skip DocuSign and Dropbox Sign for now.
2. **Payouts: Stripe Connect, model A**
   - Accounts v2, recipient configuration, Express Dashboard, Stripe-hosted onboarding (KYC and tax ID).
   - Separate charges and transfers, with ACH Direct Debit funding by default and card optional.
   - Transfers on owner or admin approval (T2); standard payouts, with Instant Payouts at 1% as a creator-paid option.
   - Stripe 1099 tax reporting ($2.99 per IRS e-file, $1.49 per state filing).
   - **US creators only at launch.** Add UK, EEA, Canada and Switzerland through Connect cross-border later.
   - Expected Stripe cost: about 1.8% (ACH) to 4.0% (card) on a $300 deal.
   - Add a brand-side payments fee of about 5% (minimum $3) in §11.
3. **Off-ramp: "Pay outside Magpie"** (model C). The customer marks invoices paid and is responsible for W-9s and 1099-NECs at $2,000 or more. Magpie never stores Social Security numbers.
4. **For the customer's repeat freelancers** with classification risk: link out to Deel (Contractor of Record at $325/month) or Ontop. Do not integrate in v1.
5. **v1.1 evaluation: Lumanu for Platforms**
   - It would cover non-US creators outside Stripe's cross-border regions, EU creators (DAC7) and enterprise customers wanting a vendor of record.
   - Compare with Trolley (licensed money transmitter, W-8 and 1042-S, DAC7; about $4,800 a year for Pay plus Tax, plus per-payout fees).
6. **Not in v1:** Stripe Global Payouts, PayPal Payouts, Wise, Tipalti, Trolley balances. Each one puts Magpie's own money in the payout flow, or costs too much at this scale.

### 7.4 Code guardrails for the Bots (add to TALENT.md §4 hard rules)

- **Refuse to send an offer** that lacks any of these:
  - a payment due date no later than 30 days after completion;
  - a disclosure clause;
  - usage scope and term;
  - the 18-or-older confirmation.
- **Templates are linted.** The phrase "work made for hire" is blocked.
- **Product before testimonial.** If a brief is testimonial-style ("I tried", "my results") and `product_seeding` is set, the upload portal stays closed until shipping shows delivered and the creator confirms use. The Content Reviewer flags claims of results ("lost 10 lbs", "made $X") for substantiation.
- **Auto-approval timer.** It must be in every agreement and enforced by a workflow, so creators aren't left waiting.
- **Annual totals per creator.** Track payout totals against the $2,000 (1099-NEC) and state 1099-K thresholds, and block payouts while a tax ID is missing.
- **Classification-risk warning for repeat freelancers.** Warn when any of these holds:
  - monthly engagements for 6 months or more;
  - hourly pay with a fixed schedule;
  - the workspace's own tools and logins are required.

  Then suggest a contractor-of-record service.
- **Country gate.** Payouts in v1 go to US creators only. Other countries are routed to "Pay outside Magpie" or the partner.

---

## 8. Open questions for Counsel and further research

1. **TPSO status.** Is Magpie, under model A, a TPSO that files 1099-K under the federal $20,000/200 rule and lower state thresholds, or a payer that files 1099-NEC at $2,000? Can customers rely on IRS FAQ Q11 to skip 1099-NECs for payments made through Magpie?
2. **Backup withholding.** Who withholds 24% when a creator's tax ID fails, and does Stripe support it?
3. **Money transmission.** A 50-state check of agent-of-payee exemptions for the model A flow, and the platform's written agreements with brands and creators. FinCEN condition (d) needs an agreement with the creator.
4. **Sales tax.** Is Magpie the merchant of record for content services under model A, and does that create sales-tax exposure in any state? Not researched.
5. **Foreign creators.** When is a usage license a US-source royalty, with 30% withholding or a treaty rate and a 1042-S?
6. **EU.** DAC7 platform-operator status, GDPR Art. 3(2) scope and Art. 27 representative.
7. **Brand-handle disclosure.** Does a UGC ad run from the brand's handle need an in-ad "paid" disclosure when the creator appears to be a customer?
8. **AB5 for UGC creators.** Does the "marketing" or "videographer" category in §2778 cover them, or does the B2B exemption (§2776) need to apply?
9. **Data to buy or request:** the Collabstr 2026 report PDF; a newer IZEA edition; any rate study on YouTube Shorts or Spark codes that discloses its method.

---

## Sources (all accessed 2026-11-10)

**Rates**
- Collabstr 2026 report coverage: [storyboard18, 2026-03-20](https://www.storyboard18.com/how-it-works/80-influencer-deals-under-300-brands-shift-to-ugc-report-92782.htm); [Hello Partner, 2026-01-13](https://hellopartner.com/2026/01/13/industry-report-reveals-the-7-influencer-marketing-trends-defining-2026); report page (blocked): https://collabstr.com/2026-influencer-marketing-report
- [Influencer Marketing Hub rates, updated 2026-10-06](https://influencermarketinghub.com/influencer-rates/)
- [Later benchmarks, 2026-07-07](https://later.com/blog/influencer-pricing-benchmarks-the-complete-2026-guide/)
- [Elev8or rate report, June 2026](https://www.elev8or.io/creator-rate-report-2026)
- [Net Influencer, 33 professionals on perpetual rights, 2026-09-11](https://www.netinfluencer.com/one-fee-no-expiration-33-creator-economy-professionals-on-whether-perpetual-usage-rights-are-ever-a-fair-deal/)
- Pitchlo via [knowlify](https://knowlify.com/articles/ugc-creator-rates) [S]
- IZEA 2023 edition via [press release page](https://izea.com/press-releases/izea-releases-the-2023-state-of-influencer-earnings/) [S]
- Billo: [pricing](https://billo.app/pricing/), [pricing blog, 2026-11-06](https://billo.app/blog/how-billo-pricing-works/), [Novoads on Billo prices, 2026-10-22](https://novoads.ai/en/blog/billo-pricing), [creator terms, effective 2026-10-01](https://billo.app/terms-of-service-creators/), [Premium criteria](https://help.billo.app/en/articles/6230554-for-creators-becoming-a-premium-creator), [creator payouts](https://help.billo.app/en/articles/5830098-for-creators-how-and-when-you-ll-get-paid), [brand payments](https://help.billo.app/en/articles/4920470-how-do-i-pay-content-creators-for-the-videos-they-create), [edits and reshoots](https://help.billo.app/en/articles/4825150-for-brands-how-to-request-edits-and-reshoots)
- [Insense pricing](https://insense.pro/pricing)
- Upwork cost pages (blocked; [S]): [video editors](https://www.upwork.com/hire/video-editors/cost/), [graphic designers](https://www.upwork.com/hire/graphic-designers/cost/), [social media managers](https://www.upwork.com/hire/social-media-managers/cost/)
- BLS Occupational Outlook Handbook: [graphic designers](https://www.bls.gov/ooh/arts-and-design/graphic-designers.htm), [film and video editors](https://www.bls.gov/ooh/media-and-communication/film-and-video-editors-and-camera-operators.htm)
- [Fiverr content-creator cost guide](https://www.fiverr.com/resources/guides/costs/content-creator) (blocked; [S])
- TikTok Spark authorization: [help](https://ads.tiktok.com/help/article/spark-ads-creation-guide), [API](https://business-api.tiktok.com/portal/docs/enable-or-disable-the-ad-authorization-setting-for-a-tiktok-post/v1.3)
- Meta partnership-ad permissions: [Instagram help](https://help.instagram.com/606568693172555/)

**Deal terms**
- [Morgan Lewis, 2024-03-20](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2024/03/social-media-influencer-agreements-part-1-considerations-when-drafting-for-a-company)
- [Farella Braun on work-made-for-hire, 2021-04-29](https://www.fbm.com/employment/publications/employment-law-issues-to-consider-before-including-work-made-for-hire-clauses-in-contractor-agreements/)
- [Cal. Labor Code §3351.5](https://california.public.law/codes/labor_code_section_3351.5)
- [SAG-AFTRA Influencer Agreement fact sheet](https://www.sagaftra.org/influencer-agreement-fact-sheet) [S]
- Late payments: [Tipalti 2023 survey](https://tipalti.com/blog/pr-2023-brand-creator-report/) [S]; [Campaign](https://www.campaignlive.com/article/billion-dollar-boy-launches-creator-payments-tackle-financial-burnout-creator-economy/1953325) [S]

**E-signature**
- [BoldSign pricing](https://boldsign.com/electronic-signature-pricing/), [BoldSign billing blog](https://boldsign.com/blogs/boldsign-plans-billing/)
- [SignWell API pricing](https://www.signwell.com/api-pricing/)
- [Documenso pricing](https://documenso.com/pricing), [Documenso Community Edition](https://docs.documenso.com/docs/policies/community-edition)
- [PandaDoc API pricing](https://www.pandadoc.com/api/pricing/)
- [Dropbox Sign API pricing](https://sign.dropbox.com/products/dropbox-sign-api/pricing)
- [DocuSign developer plans](https://ecom.docusign.com/plans-and-pricing/developer)
- [15 U.S.C. §7001](https://www.law.cornell.edu/uscode/text/15/7001)
- MRIS v. AHRN: [Justia docket](https://docs.justia.com/cases/federal/appellate-courts/ca4/12-2102/404538370) [S]
- Berman: [National Law Review summary](https://natlawreview.com/article/watch-fine-print-ninth-circuit-majority-opinion-requires-heightened-standards) [S]
- [California AB 2602 / Labor Code §927 summary (Proskauer)](https://proskauer.com/blog/california-enacts-generative-ai-law-addressing-digital-replicas-of-performers) [S]

**Payouts**
- Stripe pricing: [Connect pricing](https://stripe.com/connect/pricing), [Stripe pricing](https://stripe.com/pricing)
- Stripe tax: [tax reporting](https://docs.stripe.com/connect/tax-reporting), [1099-K state requirements](https://docs.stripe.com/connect/1099-k), [1099 forms FAQ](https://support.stripe.com/questions/1099-forms-for-platforms-and-marketplaces)
- Stripe accounts: [account types](https://docs.stripe.com/connect/accounts), [Accounts v2 configuration](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration)
- Stripe payouts: [cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts), [Global Payouts vs Connect](https://docs.stripe.com/connect/cross-border-payouts-to-recipients/compare-global-payouts)
- [Trolley pricing](https://trolley.com/pricing/), [Trolley licensing](https://trolley.com/trolley-regulatory-licenses/) [S]
- [Tipalti pricing](https://tipalti.com/approve/pricing) [S]
- [PayPal fees, updated 2026-11-04](https://www.paypal.com/us/business/paypal-business-fees)
- [Wise batch payments](https://wise.com/us/business/batchtransfer) [S]
- [Deel pricing](https://www.deel.com/pricing/)
- [Ontop pricing](https://www.getontop.com/pricing)
- Lumanu: [pricing](https://lumanu.com/pricing), [platforms](https://lumanu.com/solutions/platforms), [Superfiliate + Lumanu fee](https://help.superfiliate.com/articles/2815639973-superfiliate-lumanu) [S]
- IRS: [Form 1099-K FAQs for third-party filers, reviewed 2026-05-18](https://www.irs.gov/newsroom/form-1099-k-faqs-third-party-filers-of-form-1099-k), [Instructions for 1099-MISC/NEC](https://www.irs.gov/instructions/i1099mec) [S], [Publication 1099 (2026)](https://www.irs.gov/publications/p1099) [S], [Publication 515](https://www.irs.gov/publications/p515) [S]
- [FinCEN FIN-2014-R009](https://www.fincen.gov/sites/default/files/administrative_ruling/FIN-2014-R009.pdf)
- [Cooley on California agent-of-payee, 2021-06-28](https://www.cooley.com/news/insight/2021/2021-06-28-california-rulemaking-agent-of-a-payee-exemption-money-transmission-licensing) [S]

**Compliance**
- 16 CFR: [255.1](https://www.law.cornell.edu/cfr/text/16/255.1), [255.5](https://www.law.cornell.edu/cfr/text/16/255.5), [465.1](https://www.law.cornell.edu/cfr/text/16/465.1), [465.2](https://www.law.cornell.edu/cfr/text/16/465.2)
- [FTC Disclosures 101](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers)
- [Benesch on Part 465 warning letters, 2026-04-06](https://www.beneschlaw.com/insight/five-stars-zero-tolerance-ftc-turns-up-enforcement-under-consumer-review-rule/)
- [2026 FTC civil-penalty notice](https://public-inspection.federalregister.gov/2026-18853.pdf) [S]
- [TikTok Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) [S]
- [TikTok One eligibility](https://ads.tiktok.com/resources/help/article/how-creators-can-sign-up-for-tiktok-one) [S]
- [Meta branded content policies](https://help.instagram.com/1695974997209192) [S]
- Worker classification: [IRS Topic 762](https://www.irs.gov/taxtopics/tc762) [S], [DOL 2026 proposed rule (Morgan Lewis)](https://www.morganlewis.com/pubs/2026/03/dol-proposes-to-rescind-2024-independent-contractor-rule-and-reinstate-2021-framework) [S], [Cal. Labor Code §2778](https://california.public.law/codes/labor_code_section_2778)
- Minors: [Davis+Gilbert on AB 1880 and SB 764, 2024-11-21](https://www.dglaw.com/californias-new-laws-will-change-the-way-marketers-engage-child-influencers/), [Minnesota 2024 c.103](https://www.revisor.mn.gov/laws/2024/0/103/) [S], [Utah HB 322 enrolled](https://le.utah.gov/Session/2025/bills/enrolled/HB0322.pdf) [S], [COPPA compliance deadline (Hunton)](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches) [S]
- [DPF ruling coverage](https://vbb.com/articles/general-court-confirms-validity-of-eu-us-data-privacy-framework/) [S]
- [DAC7 overview (Fonoa)](https://www.fonoa.com/resources/blog/dac7overview) [S]
- Freelancer laws: [California FWPA (4A's)](https://www.aaaa.org/blog/new-california-freelancer-law-takes-effect-on-january-1-2025/), [Illinois FWPA (IDOL)](https://labor.illinois.gov/laws-rules/legal/freelance-worker-protection-act), [New York State FIFA (JD Supra)](https://jdsupra.com/legalnews/new-protections-for-freelancers-6777837) [S]

**Agencies**
- [Feedbird pricing](https://www.feedbird.com/pricing)
- [Feedbird editor listing (weekday.works)](https://jobs.weekday.works/feedbird-video-editor) [S]
