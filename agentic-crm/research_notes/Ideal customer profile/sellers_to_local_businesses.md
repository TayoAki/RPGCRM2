# ICP demand evidence: companies that sell to local businesses and trades (as of 2026-11-10)

**Segment under test.** Companies of 5 to 200 employees, with SDRs or a small sales team, whose customers are local businesses and trades:
- Vertical SaaS for contractors, home services, restaurants, clinics, salons and other SMBs (field service, construction, restaurant, salon software).
- B2B service providers and suppliers selling to those businesses: commercial cleaning, equipment and building-material suppliers, solar, roofing, and insurance-adjacent sellers who use permit data.

**Why we are testing it.** The product is an AI CRM whose Bots find prospects in public data (permits, business registrations, contractor licenses, Google Places, public bids), research them, draft outreach and ask the seller to approve.

**Source legend**
- **[V]** = verbatim quote, copied from the fetched page. **[P]** = paraphrase or summary. Never treat a [P] as a quote.
- **[1P]** = the company's own page. **[3P]** = third party. **[Vendor]** = the publisher sells a competing or adjacent product, so its claims are self-interested.
- Dates are publish or post dates. "Fetched Nov 2026" means the page showed no date and was read on or around 2026-11-10. Anything before 2025 is flagged **(older)**.

**Method notes (read before reusing quotes)**
- **Reddit.** reddit.com and old.reddit.com are blocked from this environment, so Reddit threads were read through the archive mirror `reddit.sentinel-team.org`. Each item gives the original reddit.com URL that the mirror records, plus the mirror URL. The mirror's "N days ago" labels count back from 2026-11-10 and match the snapshot dates, so post dates are given as roughly the snapshot date.
- **Quote extraction.** Quotes were pulled from fetched pages by an extraction step. Spot-check them against the live page before using them in external material.
- **LinkedIn.** No `linkedin.com/posts` result came back from any search, and LinkedIn does not render to fetch. There are **no LinkedIn quotes** in this file. The nearest substitutes are the RevGenius and Clay community threads and the founder and operator quotes in vendor and investor posts.
- **Search budget.** The shared web-search budget ran out near the end of the research. Some items were never checked (SafeGraph, Cobalt Intelligence, Enigma, current Data Axle prices, r/HVAC and r/Roofing threads). See "Gaps" at the end.

---

## Strongest findings (summary)

1. **The core pain is real and stated in buyers' own words.** Local-business owners are not on LinkedIn, so Apollo, ZoomInfo and LinkedIn-based tools miss them. Teams fall back to copying Google Maps listings by hand, then hit generic info@ inboxes, bounces and stale owners.
   - Practitioner quotes: "Two hours for maybe 40 usable contacts"; "Google Maps emails are fake 40% of the time"; "We're calling small business owners who often don't have LinkedIn profiles". A distributor said of its Google Maps workflow: "We never would have been able to do that in Zoominfo."
2. **Money is already flowing to "local-business data for sellers".** DataLane raised a $22.5M Series A (Dec 2025); its named customers are Olo, ShopMonkey and DoorDash. Leadbay raised a $4.3M seed (May 2026). Openmart (YC W24) is selling. Fairground (formerly Orbital) sells data and $450-per-meeting outbound to Housecall Pro, Podium, FieldPulse and others. Shovels is at about $3M ARR (Sacra estimate, Aug 2026) at $599 or $999 a month.
3. **The closest product to ours already exists in pieces.**
   - Openmart has an agent ("Openclaw for sales") that "finds, scores, and drafts outreach", plus sequencing. It costs $149 to $299 a month.
   - Shovels has an AI agent ("Charlie") over its permit data.
   - Clay has a Google Maps source plus an SMB owner-enrichment recipe.
   - None of them combines *multi-source public-record triggers + research + drafted outreach + a human approval step inside a CRM*. That combination is the open lane.
4. **The motion is phone-heavy.** Job posts: FieldPulse "Make 150-200 calls per day"; an HVAC SaaS SDR makes "80 cold calls per day"; a Pella distributor asks reps to "Regularly visit permit offices or review permit reports." The owner-side and practitioner quotes say cold email to tradespeople underperforms ("Plumbers don't check email during the work day").
   - Implication: the Bots should produce call lists with verified owner mobiles and a one-line reason to call, not only email drafts.
5. **Permit data works, but its lag is the main objection.** Records appear "three to four weeks after approval", and Shovels refreshes monthly according to a third-party directory. Documented wins exist anyway:
   - PARR Lumber: ">$1 million in new sales in their first year working permit-based opportunities" (vendor-sponsored).
   - JAN-PRO commercial cleaning: Convex property data produced 26% of one rep's leads and $125K of retained contract revenue over two years.
6. **Compliance shapes the product.**
   - Google's terms bar scraping Maps content. Only `place_id` may be stored indefinitely through the Places API, so the Bots should use the official API and refresh records rather than keep scraped copies.
   - Gmail caps spam complaints at 0.3%.
   - Texas SB 140 (effective 2025-09-01) brings texts under its telemarketing law.
   - An approval-first design is a selling point against AI SDR skepticism. At 11x, staff told TechCrunch "We were losing 70-80% of customers" (Mar 2025).
7. **Buyer-side triggers are detectable.** Look for SDR/BDR job posts with cold-call quotas aimed at contractors or restaurants, new Shovels, Clay, Openmart or DataLane adoption, and seed or Series A rounds at vertical SaaS companies.

---

## 1. Pain in the buyer's own words

### Takeaway
People who sell to local businesses describe the same loop again and again:
1. LinkedIn-based data does not cover owners.
2. So they build lists from Google Maps by hand or with scrapers.
3. Those lists produce generic inboxes, bounces and stale owners.
4. Reps then dial at high volume because email does not reach tradespeople.

Permit-based sellers add a timing pain (records lag weeks) and a triage pain (raw permit dumps are mostly noise).

### A. Building lists by hand from Google Maps
1. [V] "Open a Maps listing, navigate to the website, find the contact page, copy the email into a spreadsheet." / "Two hours for maybe 40 usable contacts." / "Senior people do it the same way as people who just started."
   - u/Due-Bet115, r/Entrepreneur, "Manual local prospecting is more common than I thought". [reddit](https://reddit.com/r/Entrepreneur/comments/1rq5yof/manual_local_prospecting_is_more_common_than_i/) · [mirror](https://reddit.sentinel-team.org/posts/1rq5yof/snapshots/2026-03-11T23%3A24%3A49.304676Z). ~2026-03-11.
2. [V] "by the time you've built the spreadsheet half the emails bounce anyway."
   - u/TeslaLegacy, same thread. ~2026-03.
3. [V] "Building prospect lists manually from Google Maps was eating 3–4 hours per campaign." / "Copy-paste, missing data, duplicates everywhere."
   - u/IndianSoloFounder, r/digital_marketing. [reddit](https://reddit.com/r/digital_marketing/comments/1snc2gh/how_i_rebuilt_our_local_b2b_prospecting_workflow/) · [mirror](https://reddit.sentinel-team.org/posts/1snc2gh/snapshots/2026-04-17T02%3A09%3A56.533223Z). ~2026-04-17.
4. [V] "manually collecting business data from Google Maps takes way too much time"
   - u/SolomonDaGod, r/BusinessIntelligence, "Best way to scrape Google Maps business data in 2026?". [reddit](https://reddit.com/r/BusinessIntelligence/comments/1tej254/best_way_to_scrape_google_maps_business_data_in/) · [mirror](https://reddit.sentinel-team.org/posts/1tej254/snapshots/2026-05-20T05%3A06%3A06.631882Z). ~2026-05-16.
5. [V] "we quickly realized how much time gets wasted copying business information from Google Maps one by one."
   - u/Separate-Okra-4611, r/GoogleMaps. [reddit](https://reddit.com/r/GoogleMaps/comments/1td0my3/how_to_collect_local_business_leads_from_google/) · [mirror](https://reddit.sentinel-team.org/posts/1td0my3/snapshots/2026-05-15T05%3A00%3A13.257951Z). ~2026-05-14.
6. [V] "Maps changes their layout often enough to break selectors." (u/DowntownPresent5293) / "you'll hit rate limits fast on large areas." (u/Complete-Cloud-3969) / "Google Maps blocks fast requests pretty aggressively." (u/EarlyMaximum3236, r/GoogleMaps)
   - Threads cited in items 4 and 5. ~2026-05.
7. [V] "It was a lot more manual work, just relying on Google (and) Google Earth."
   - Danielle Ross, sales rep at JAN-PRO of Northwest Florida (commercial cleaning), describing life before Convex. [ServiceTitan blog [1P/Vendor]](https://www.servicetitan.com/blog/success-story-jan-pro-convex). 2026-09-18.

### B. Generic inboxes, bad emails and bounces
8. [V] "Google Maps emails are fake 40% of the time. I didn't validate my list for months and my bounce rate was horrible." / "Plumbers don't check email during the work day." / "50 emails with 3 "interested" replies beats 200 emails with 10 "how did you get my email" replies."
   - u/Typical-Particular-6, r/DigitalMarketing, "I spent 2 years doing cold outreach to local businesses." [reddit](https://reddit.com/r/DigitalMarketing/comments/1sr2di9/i_spent_2_years_doing_cold_outreach_to_local/) · [mirror](https://reddit.sentinel-team.org/posts/1sr2di9/snapshots/2026-04-21T06%3A25%3A49.004749Z). ~2026-04-21.
9. [V] raw exports often include a "generic contact email that goes nowhere."
   - u/SpecialistBill3836, r/BusinessIntelligence (item 4 thread). This commenter goes on to promote a tool. ~2026-05.
10. [V] "Absolutely no reason to be doing this manually, especially if you're just scraping generic emails from the website."
    - u/janebartonc, r/Entrepreneur (item 1 thread). The commenter promotes LeadSwift and Apify. ~2026-03.
11. [V] "the data that came back had more holes than hits."
    - Jared Schrieber, 2★ verified Outscraper review. [Trustpilot](https://www.trustpilot.com/review/outscraper.com). 2026-10-27.
12. [V] "the data quality was so poor (hovering around 30-40% accuracy)"
    - A RevOps leader describing legacy data vendors, as recounted in Amplify Partners' DataLane Series A post. [Amplify [3P/investor]](https://amplifypartners.com/blog-posts/announcing-datalane-building-the-data-layer-for-the-local-economy). 2025-12-16.

### C. Owners are not on LinkedIn and are hard to reach
13. [V] "We're calling small business owners who often don't have LinkedIn profiles" / "does anyone know if it's possible to find 1) the first name of the business owner and 2) the business owner's cell phone"
    - Brian C., RevGenius #chat-revops. [RevGenius](https://community.revgenius.com/x/chat-revops/n6vuoiftu9wu/finding-business-owner-info-tips-for-enriching-lea). 2025-04-18.
    - Reply [V]: "For restaurants, I've heard really good things about Datalane for mobile numbers" (Gabe Naviasky).
14. [V] "Contractors maintain accurate Google Maps listings because they need service calls." / "We never would have been able to do that in Zoominfo."
    - Andrew Thomas, Director of Marketing, Regency Supply (commercial lighting and electrical distributor). The case study frames the problem [P]: many local electrical contractors are not active on LinkedIn, and ZoomInfo or Apollo could not verify them. [Clay customer story [1P/Vendor]](https://clay.com/customers/regency-supply). Undated (fetched Nov 2026).
15. [V] "I've wasted so many hours on LinkedIn trying to find contact info manually."
    - Original poster, r/EntrepreneurRideAlong, "any free lead gen tools for finding business contacts?". [reddit](https://reddit.com/r/EntrepreneurRideAlong/comments/1tdppqw/any_free_lead_gen_tools_for_finding_business/) · [mirror](https://reddit.sentinel-team.org/posts/1tdppqw/snapshots/2026-05-16T08%3A14%3A59.566335Z). ~2026-05-15.
    - Reply [V]: "Ten targeted emails with context usually outperformed blasting 200 generic ones from questionable data." (u/AdventurousLime309)
16. [V] "The franchise owner running 15 Burger King locations isn't posting on LinkedIn." / "the decision-makers in these industries simply aren't where traditional data providers look for them."
    - Amplify Partners (investor, not a buyer). [Amplify](https://amplifypartners.com/blog-posts/announcing-datalane-building-the-data-layer-for-the-local-economy). 2025-12-16.
17. [V] "Most B2B databases have a large gap when it comes to small businesses like HVAC technicians, salons, and restaurants." / "Local businesses often have limited internal teams whose time is primarily dedicated to serving their customers."
    - Clay blog (vendor, but an admission from a data vendor). [Clay](https://clay.com/blog/google-maps-lead-generation-for-niche-leads). 2026-04-10.
18. [V] "It's just very hard to find that retail information."
    - Kathryn Wu, Openmart co-founder, describing her own pain selling to local businesses. [TechCrunch](https://techcrunch.com/2024/08/21/openmart-wants-to-make-it-easier-for-enterprises-to-sell-to-local-businesses). 2024-08-21 **(older)**.
19. [V] "call screening tools and ai assistants make actually getting through to somebody even harder too."
    - u/ImBonRurgundy, r/sales, "I feel sorry for SDRs". [reddit](https://reddit.com/r/sales/comments/1q8f0lz/i_feel_sorry_for_sdrs/) · [mirror](https://reddit.sentinel-team.org/posts/1q8f0lz/snapshots/2026-01-12T05%3A20%3A16.002895Z). ~2026-01-10.

### D. Data decay
20. [V] "the biggest hurdle with the Google Maps to LinkedIn pipeline is always data decay." / "Businesses change names or owners faster than Google updates their pins" / "Everyone is using AI to write generic I saw your business on Maps messages"
    - u/DowntownBranch5337, r/digital_marketing (item 3 thread). ~2026-04.

### E. Finding new permits and new projects early
21. [V] "Permit records become available three to four weeks after approval." / "A fast remodel may already be locked up by the time the data reaches a sales team." / "Reps should get qualified opportunities, not a county spreadsheet."
    - Ryan Dempsey, NRLA (lumber dealers' association), sponsored content from SalesJack [Vendor]. [NRLA](https://nrla.org/how-permit-data-and-ai-help-lumberyards-win-more-business/). 2026-07.
22. [V] "shooting an arrow through a hole in the fence."
    - Gary Stein, 61HAWK, on finding rare permits for automated parking systems before using Shovels' AI agent. [Shovels case study [1P/Vendor]](https://www.shovels.ai/blog/case-study-61hawk/). 2026-01-28.
23. [V] "Shovels provides us with actionable insights that we couldn't efficiently gather before."
    - Nícolas Fonteyne, Founding AI Engineer, Boldr (HVAC thermostat company recruiting mini-split installers). [Shovels [1P/Vendor]](https://www.shovels.ai/blog/case-study-boldr/). 2025-08-11.

### F. SDR cost and throughput
24. [V] "At our org one outbound SDR costs ~$160k all in and brings in easy 600k-1m+ per year."
    - u/IcyFocus365, r/sales (item 19 thread). ~2026-01.
    - Counterpoint in the same thread [V]: "Personalization does not equal relevance. Automation at scale doesn't equal opportunity." (u/Seven_Figure_Closer)
25. [V] "Make 150-200 calls per day."
    - FieldPulse SDR posting (field service software for the trades). [Rippling ATS](https://ats.rippling.com/fieldpulse/jobs/c0b506af-982b-4a01-a16f-1faa7d05b11c). Undated (fetched Nov 2026).

### G. The owner's side (what the prospect will tolerate)
26. [V] "Don't waste your time sending me cold emails or LinkedIn messages asking for a meeting or sharing product demos." / "A personal recommendation is far more valuable than a perfect pitch."
    - Mike Wang, owner of about 40 restaurants and CEO of ROGER. [thanksroger.com](https://www.thanksroger.com/blog/top-10-mistakes-selling-to-smb-owners-like-me). Dated 2023-08-23 on the page, 2026-01-12 in the metadata **(older)**.
27. [V] "No business owner has time to read or interest in reacting to cloned email cadences and break-up emails." / "Owners at SMBs have no one."
    - SaaStr writeup of Loren Padelford, CRO of Slice (vertical SaaS for pizzerias). [SaaStr](https://www.saastr.com/things-i-learned-from-loren-padelford-cro-of-100m-arr-slice). Undated.
28. [V] "Plumbers and HVAC guys trust peer referrals almost exclusively." (u/gptbuilder_marc) / "Call or walk into businesses where the owner is still close to dispatch." (u/wesdacar) / "find one contractor whose reviews mention missed calls or slow callbacks" (u/vietbaoa4htk)
    - r/SaaS, "How would you find the first paying customer for a local contractor SaaS?". [reddit](https://reddit.com/r/SaaS/comments/1u1m0ld/how_would_you_find_the_first_paying_customer_for/) · [mirror](https://reddit.sentinel-team.org/posts/1u1m0ld/snapshots/2026-06-10T05%3A26%3A08.971399Z). ~2026-06-10.
29. [V] "They are already doing well offline, so they do not feel the urgency."
    - u/_Simple_Observer_, on high-review businesses with no website, r/digital_marketing (item 3 thread). ~2026-04.

### Job posts that show the motion (vertical SaaS and suppliers)
| Company (what it sells) | Verbatim line | Date | Source |
|---|---|---|---|
| Gunton Corp, largest independent Pella windows and doors distributor | "Regularly visit permit offices or review permit reports to uncover active new projects and accounts in your area." / "targeting local builders, contractors, remodelers, and replacement companies" | Undated (fetched Nov 2026) | [Paylocity](https://recruiting.paylocity.com/Recruiting/Jobs/Details/3476518) |
| JobNimbus (roofing and contractor CRM) | "outbound prospecting (calls, email, LinkedIn, video) into contractors and roofing businesses" | Removed 2026-07-17 | [Built In](https://builtin.com/job/sales-development-representative/8926142) |
| FieldPulse (field service management for the trades) | "Make 150-200 calls per day." / "Utilize SalesForce/Salesloft, cold calling, and email to generate new sales opportunities." | Undated (fetched Nov 2026) | [Rippling](https://ats.rippling.com/fieldpulse/jobs/c0b506af-982b-4a01-a16f-1faa7d05b11c) |
| Unnamed HVAC lead-handling SaaS (offshore SDR) | "Make 80 cold calls per day to HVAC companies across the US" / "Base Salary: $200 USD / month" + "$30 USD per Verified Qualified Meeting" / works from "a curated lead list" | 2026-05-19 | [OnlineJobs.ph](https://www.onlinejobs.ph/jobseekers/job/1649787) |
| Owner.com (AI growth system for local restaurants) | "Experience with restaurants or small businesses (selling to or working in!) is a huge plus." / "$75,000 CAD OTE ($60,000 base $15,000 incentive…)". The role is warm-inbound follow-up | Removed 2026-03-02 | [Built In](https://builtin.com/job/sales-development-representative-toronto/4499800) |
| Loop (restaurant delivery P&L co-pilot) | "Conduct outbound prospecting activities, including cold-calling, email outreach, and social media engagement." | 2026-06-16 | [Base10 job board](https://careers.base10.vc/companies/loop-2-afe4c6e3-1664-4aac-b8e2-6076a1b2ef38/jobs/82938065-sales-development-representative) |

- [P] Not opened, seen in search snippets only:
  - AccuLynx SDR, "75+ outbound cold calls and emails".
  - Hireframe SDR qualifies contractors by "company size (10–50+ employees)".
  - Restaurant365 SDR, outbound to restaurants.
- No posting found names Google Maps scraping or Shovels as a required tool. The evidence of the motion is call quotas plus "curated lead list" language.

### Reviews of local lead-data tools
- **Outscraper**, Trustpilot 4.6 from 344 reviews. [Trustpilot](https://www.trustpilot.com/review/outscraper.com)
  - [V] "I was able to generate a list of 500 leads within minutes" (Jason Scott, 2026-01-03).
  - [V] "from testing about 85% accurate on contact info" (SK, 2026-02-21).
  - [V] "the pricing is fair for the quality of the data." (Julian, 3★, 2026-10-31).
  - [V] "the data that came back had more holes than hits." (Jared Schrieber, 2★, 2026-10-27).
  - [V] unrequested add-ons were charged: "proceeded to add multiple additional services to my request that I didn't ask for" (Empire Origins, 1★, 2026-10-29).
- **D7 Lead Finder** [P]:
  - Small, aging review base: 3.6 to 3.9 out of 5 on G2/Capterra across 4 to 8 reviews.
  - Complaints of "outdated Google Maps data" and poor support (late-2023 Capterra reviews), and no CRM sync or sequencing.
  - Sources are competitor blogs. [Saleshandy [Vendor]](https://www.saleshandy.com/blog/d7-lead-finder-reviews); [Prospeo [Vendor]](https://prospeo.io/s/d7-lead-finder-pricing-reviews-pros-and-cons). 2026.
- **Brizo (foodservice data)** [P, search snippet; the source page was not opened]: one reviewer liked the filters but said "some of the contact information is outdated and needs to be cleaned". Freshness on closed or relocated restaurants is the main risk flagged. [GTM Directory](https://thegtmdirectory.com/tools/brizo). 2026.
- **Convex (ServiceTitan)** [P]: 4.6/5 from 19 reviews. Reviewers report a slow map view and cumbersome campaign setup. [GetApp](https://www.getapp.co.uk/software/2078758/convex). 2026.
- **ConstructConnect** [P]: G2 4.4 from 112 reviews. Public reviews question whether the leads justify the cost for smaller buyers. [rfp.wiki](https://www.rfp.wiki/vendors/constructconnect). 2026.

---

## 2. Trigger events (each detectable from data)

### Takeaway
Two layers matter.
- **Prospect-level triggers** are what the Bots watch on local businesses. Permits, new registrations, licenses and openings are all public, but each comes with a lag and a matching problem.
- **Buyer-level triggers** tell us when an ICP company is ready for our CRM. They are mostly hiring and tool-adoption signals.

### A. Prospect-level triggers (the Bots watch these)
| Trigger | What it signals to a seller | Where it is observable | Freshness / lag | Access and cost | Evidence |
|---|---|---|---|---|---|
| **New building permit filed or issued** | A project with budget, the named contractor, and a property owner. For suppliers and trade SaaS, the *contractor* who pulled it is the prospect. | City and county permit portals and open-data portals. Aggregators: **Shovels** (permits, contractors, properties, residents, employees datasets), **BuildZoom** (350M+ permits), **ATTOM** (300M+ permits, add-on), **Construction Monitor**, **Ohm Analytics** (solar). Apify actors scrape city portals. | Records appear "three to four weeks after approval", some within a week, slow jurisdictions two to three months ([NRLA/SalesJack](https://nrla.org/how-permit-data-and-ai-help-lumberyards-win-more-business/), 2026-07). Shovels: "monthly, released on the 1st per API docs" per a third-party directory, which also claims "5M new permits added monthly" ([GTM Directory](https://thegtmdirectory.com/tools/shovels)). | Shovels Free (500 credits) / $599 / $999 / Enterprise ([pricing](https://www.shovels.ai/pricing), fetched Nov 2026). Apify city scrapers from about $1.80 to $3.00 per 1,000 records. ATTOM from $500/mo with permits as an add-on ([ATTOM](https://www.attomdata.com/solutions/delivery/property-data-api/pricing/)). | PARR Lumber, Boldr, 61HAWK (see §7). Workflow per the directory [P]: filter contractors by trailing-12-month permit count, export up to 1,000, enrich in Clay, push to HubSpot. |
| **Contractor velocity** (a contractor's permit volume rising) | A growing contractor that needs software, suppliers, insurance and financing. | Shovels contractor metrics (`tag_tally`, `status_tally`; 90-day windows by `permit_tags`, e.g. hvac). | Same as permits. | Same as above. | [Shovels + Clay guide](https://www.shovels.ai/blog/how-to-supercharge-lead-generation-with-shovels-api-and-clay/) (2025-06-07). |
| **New contractor license** | A newly licensed trade business, a new market entrant, or license verification. | State licensing boards. Shovels "Nationwide Contractor State License File" (launched 2025-05-30, per its [blog](https://www.shovels.ai/blog)). BuildZoom contractor licenses. | Varies by board (not verified). | Included in Shovels plans; BuildZoom is sales-gated ([GTM listing](https://www.buildzoomdata.com)). | Thumbtack uses Shovels license data to verify pros ([Shovels](https://www.shovels.ai/blog/thumbtack-case-study/), 2026-07-28). |
| **New business registration (LLC or corp filing)** | A business in setup mode: it needs POS, insurance, payroll, cleaning, signage, software. | State Secretary of State registries. **Florida Sunbiz offers free daily bulk files** over SFTP, with officers and registered agent ([FL DOS data downloads](https://dos.fl.gov/sunbiz/other-services/data-downloads/)). Minnesota sells an active-business dataset for $30 ([Prospeo [Vendor]](https://prospeo.io/s/find-new-business-listings)). Apify actors cover CO, CT, OR, TX, NY, PA. | Daily in FL. Filings take about one business day to appear (secondary source). | Free from the state (fixed-width files). Apify about $3 to $4 per 1,000 leads ([Apify](https://apify.com/lergassy/us-business-filings)). | [P] "building your own lists from secretary of state filings works but takes forever" (r/sales mirror search snippet; thread not opened). |
| **Future opening / new location** | A venue opening soon: the window to sell POS, software, supplies, cleaning, insurance. | **Google Places API** `businessStatus = FUTURE_OPENING` plus `openingDate` ("The date this place will open in the future"), Pro SKU ([Places reference](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places), [data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)). **Liquor-license applications**: TX TABC, CA ABC, NY SLA, FL DBPR. | A liquor application signals an opening about 30 to 90 days out (vendor claim, [Apify](https://apify.com/rook-data-tools/new-liquor-license-leads)). Health permits are local only, with no bulk feed found. | Places API Pro SKU. State liquor data is public. | Restaurant tech, beverage distributors, POS and insurers are the named buyers on liquor-feed listings [P]. |
| **New trucking authority (FMCSA)** | A carrier "legally cannot haul a load until insurance is filed": the classic insurance trigger. | FMCSA Company Census File / Motus. The legacy L&I register was retired in May 2026 (per vendors). | Authority and insurance fields lag "a few weeks" for new registrations (vendor). | $2 to $20 per 1,000 via Apify feeds. Truckr is built for trucking-insurance agents. | [Apify](https://apify.com/nerolabs/new-trucking-company-leads); [G2 Truckr](https://www.g2.com/sellers/truckr). |
| **Review volume or reputation change** | Growth (a review surge), pain ("missed calls" in reviews), or digital gaps ("200+ Google reviews and no website"). | Google Places `userRatingCount`, `rating` (Enterprise SKU), `reviews` (Enterprise + Atmosphere). Yelp. | Real-time, **but** Places content may not be cached except `place_id`, so trend-tracking needs re-fetching rather than stored history ([Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)). | Places Enterprise SKU. | [V] "A business with 200+ Google reviews and no website is basically pre-qualified." (r/digital_marketing, ~2026-04). [V] "find one contractor whose reviews mention missed calls or slow callbacks" (r/SaaS, ~2026-06). Clay's playbook uses a Claygent summary of a review from the past six months as the personalization line ([Clay](https://clay.com/blog/google-maps-lead-generation-for-niche-leads), 2026-04-10). |
| **Commercial property ownership or tenant change** | A new tenant needs cleaning, HVAC service, security, telecom. | Convex (property records, permits, tenant and ownership data, about 6M commercial properties). County assessor and recorder. | Not verified. | Convex is quote-only. | [P] Vendors call businesses moving into new spaces "some of the highest-converting prospects" for commercial cleaning ([Convex [Vendor]](https://www.convex.com/blog/commercial-cleaning-leads-how-property-intelligence-reveals-hidden-opportunities)). |
| **Hiring at the local business** | Growth: adding techs or locations. | Job boards (Indeed etc.). Origami's agents scan job postings [P]. | Not verified for SMBs. | Not verified. | Weak for very small shops. Not verified in this pass. |
| **Funding at the local business** | Rare for this segment. SBA loans or UCC filings might proxy it. | Not verified in this pass. | | | Treat as low-priority for prospect-level triggers. |

### B. Buyer-level triggers (the ICP company is ready to buy our CRM)
- **Hiring SDRs/BDRs with phone quotas aimed at trades or restaurants.**
  - Observable in public ATS boards: Greenhouse, Lever, Ashby, Rippling, Built In.
  - Examples: FieldPulse ("150-200 calls per day"), JobNimbus, Owner.com, Loop, Restaurant365, and the offshore HVAC SDR posts (see §1).
  - Sub-signal: a post that names "permit offices or permit reports" (Gunton/Pella).
- **New tool adoption:**
  - Shovels self-serve sign-ups at $599 to $999 a month.
  - Clay Google Maps workflows: Clay University has a lesson on "Google Maps Prospecting".
  - Openmart, DataLane or Fairground logos on the customer pages.
- **Funding.** Seed or Series A rounds at vertical SaaS for trades, restaurants and clinics. Observable on Crunchbase and in press. (Not tracked systematically in this pass.)
- **Vertical or geographic expansion.** "Expanding to the US" announcements. Example: YC told Leadbay to expand into the U.S. (Aug 2025).

---

## 3. Watering holes

### Takeaway
GTM engineers and RevOps people at these companies gather in the Clay Slack and Clay Clubs, RevGenius and Pavilion, and Reddit (r/sales, r/coldemail, r/SaaS, r/Entrepreneur, r/digital_marketing). Vertical SaaS leaders gather at vertical-software conferences and at their customers' trade shows: Pantheon, the NRA Show and MURTEC.

### Sales and GTM communities
| Community | Size / format | Evidence of this topic there | Source (date) |
|---|---|---|---|
| **Clay Slack + Clay Clubs** | "35k Slack community members"; clubs in "90+ cities"; "250+ community events per year"; free | Google Maps prospecting threads, e.g. "GTM Strategy: Using Google Maps for Outbound Success in Clay" (2024-12-02 **(older)**). Clay University lesson on Google Maps prospecting. | [Clay community](https://www.clay.com/fr/community) (fetched Nov 2026); [thread](https://community.clay.com/x/general/nugq81ocq359/gtm-strategy-using-google-maps-for-outbound-succes); [Clay University](https://clay.com/university/lesson/scrape-google-maps) |
| **RevGenius** | Free; claims of 50k to 60k members (third-party, conflicting) | The thread on finding SMB owners' first names and cell phones (2025-04-18) | [thread](https://community.revgenius.com/x/chat-revops/n6vuoiftu9wu/finding-business-owner-info-tips-for-enriching-lea) |
| **Pavilion** | Paid; "thousands of members across 450+ cities"; 4,427 new members in 2024 | No topic-specific thread found | [HumanX sponsor page](https://www.humanx.co/us/sponsors/pavilion); [Pavilion 2024 review](https://www.joinpavilion.com/2024-year-in-review) |
| **Bravado "War Room"** | Sales community forum | Post titled "Lead Sourcing (High Outbound Phone Volume to Niche Market)". Content not read because bravado.co is blocked from this environment. | [bravado.co](https://bravado.co/war-room/posts/lead-sourcing-high-outbound-phone-volume-to-niche-market) |
| **Reddit** | r/sales, r/coldemail, r/SaaS, r/Entrepreneur, r/EntrepreneurRideAlong, r/digital_marketing, r/BusinessIntelligence, r/GoogleMaps, r/solar, r/sales_intelligence | All the §1 threads (2026). Tool vendors (LeadSwift, WebLeads, Openmart) astroturf these threads heavily, which shows where vendors think buyers are. | See §1 |
| **Tool directories GTM engineers read** | The GTM Directory, ColdIQ tool pages, Apify Store, Product Hunt | Shovels, Openmart, D7 and Brizo all profiled | [GTM Directory: Shovels](https://thegtmdirectory.com/tools/shovels); [ColdIQ: Shovels](https://coldiq.com/tools/shovels) |

### Vertical SaaS founder and operator events
- **Vertical SaaS Group Conference / Vertical Software Summit**, Miami, 2026-11-04 to 05. Two listings that may be one event. [Dealroom](https://dealroom.co/events/vertical-software-summit-2026/)
- **Vertex: The Vertical Software Conference** (Spring and Fall 2026 editions). [Luma](https://luma.com/Vertex-Fall-2026)
- **Verticals Summit 2026** (Munich; invite-only; SME Tech Leaders). Europe, so lower priority. [Luma](https://luma.com/3i9rsoh3)
- **Vertical AI Summit**, NYC, 2026-06-02 (Founderpath; about 100 attendees). [Founderpath](https://founderpath.com/events/saas/vertical-ai-summit/2026-nyc)
- **SaaStr Annual 2026**, SF Bay, May 12 to 14. [SaaStr](https://www.saastrannual2026.com/vertical-saas-conference-2026)

### The end customers' trade shows (where vertical SaaS and supplier sellers exhibit)
- **ServiceTitan Pantheon** (home and commercial trades), Orlando, 2026-10-05 to 07. "more than 5,000 contractors and industry experts"; roofing track "nearly a dozen sessions". [Pantheon](https://pantheon.servicetitan.com/); [ServiceTitan blog](https://www.servicetitan.com/blog/pantheon-2026-live-coverage)
- **National Restaurant Association Show**, Chicago, 2026-05-16 to 19. About 2,300 exhibitors and a TECH Pavilion. [Informa](https://informaconnect.com/national-restaurant-association-show-posts-year-over-year-attendance-growth-with-gains-across-every-industry-segment/)
- **MURTEC** (multi-unit restaurant tech), Las Vegas, March 2026, about 1,200 attendees. MURTEC Executive Summit, San Diego, 2026-10-21 to 23. [EnsembleIQ](https://ensembleiq.com/event/murtec-2026/)
- **Trade media and associations where permit-data vendors publish:**
  - RoofersCoffeeShop (Convex posts). [RCS](https://www.rooferscoffeeshop.com/post/how-data-is-redefining-commercial-roofing-prospecting)
  - LBM Journal and NRLA (SalesJack partner content). [NRLA](https://nrla.org/how-permit-data-and-ai-help-lumberyards-win-more-business/)
  - PHCC chapters and contractor Facebook groups (advice in the r/SaaS thread, ~2026-06).
- **Not verified:** AHR Expo, International Roofing Expo, RE+, ISSA, IBS. The search budget ran out before these were checked.

---

## 4. Budget behavior (what they already pay)

### Takeaway
Buyers already pay for this problem at several layers:
- **Cheap scrapers:** $1 to $3 per 1,000 Google Maps places.
- **Self-serve local data and agents:** $105 to $299 a month (Openmart). Shovels at $599 to $999 a month. Clay at $167 to $446 a month.
- **Enterprise data:** ZoomInfo at $15K+ a year. DataLane, Brizo and Convex quote-only.
- **People:** an $80K median OTE SDR, "~$160k all in", or $450 per held meeting outsourced (Fairground).

The pattern is several tools stitched together with manual work. That favors one product that replaces the stitching.

### Price table
| Tool | What they pay | Liked | Hated | Source (date) |
|---|---|---|---|---|
| **Shovels** (permits, contractors, residents) | Free 500 credits/mo; **Basic $599/mo** for 25,000 credits (≈$0.024/record); **Pro $999/mo** for 50,000 credits, up to 2 seats; Enterprise and EDL custom. "1 credit = 1 record". Includes the API, CLI, Sheets add-on and the Charlie AI agent. | Gets them "insights we couldn't efficiently gather before" (Boldr) | Monthly refresh is "ambiguous" for daily triggers [P, directory] | [Shovels pricing [1P]](https://www.shovels.ai/pricing) (fetched Nov 2026); [GTM Directory](https://thegtmdirectory.com/tools/shovels) |
| **Openmart** (local-business data + agent) | Free (200 credits, 50 searches); **Starter $149/mo or $105 annual** (5K credits); **Pro $299/mo or $209 annual** (10K credits, 3 seats); Enterprise custom. Business email 0.3 credits, **owner email 3**, **owner phone 8** (≈$0.24 on Starter monthly); exports charged only with a verified email or phone. | Owner contacts; Maps, Reviews and Yelp scrapers built in | [P] Extraction limits hit faster than expected (directory paraphrase) | [Openmart pricing [1P]](https://www.openmart.com/pricing) (fetched Nov 2026); [GTM Directory](https://thegtmdirectory.com/tools/openmart) (2026-10-31) |
| **Fairground** (formerly Orbital) | **Direct: "Meetings from $450 per qualified & held meeting"**, no-shows not billed. Data: free starter (100 searches and 100 companies a week); paid prices not listed | "Verified owner mobiles and emails, beyond LinkedIn" (claim) | — | [Fairground pricing [1P]](https://fairground.run/pricing) (fetched Nov 2026) |
| **Clay** | Free; **Launch $167/mo annual or $185 monthly**; **Growth $446/mo annual or $495 monthly**; HTTP API and CRM integrations on Growth+; Clay API on Enterprise only | Google Maps source plus SMB owner waterfall; "We never would have been able to do that in Zoominfo" (Regency) | The Google Maps source covers one region per query and caps at 1,000 results by default. Clay itself suggests D7 or Outscraper for multi-city lists | [Clay pricing](https://www.clay.com/pricing) (via sibling note `../AI native CRM SaaS rebuild/data_enrichment_layer.md`, fetched Nov 2026); [Clay blog](https://clay.com/blog/google-maps-lead-generation-for-niche-leads) (2026-04-10) |
| **Outscraper** | First 500 businesses free; **$3 per 1,000** (501 to 100K); $1 per 1,000 above 100K. Emails & Contacts add-on priced the same | "500 leads within minutes"; "about 85% accurate" | "more holes than hits"; billing complaints | [Outscraper pricing [1P]](https://outscraper.com/pricing/) (fetched Nov 2026); [Trustpilot](https://www.trustpilot.com/review/outscraper.com) (2026) |
| **Apify Google Maps Scraper** (compass) | From **$1.50 per 1,000 places**; contacts enrichment about $1.50 to $2.00 per 1,000; 690,789 total users and 47,441 monthly; rated 4.71 | Cheapest at scale ("Apify… cheapest option", r/BusinessIntelligence) | Leads-enrichment `email` and `mobileNumber` often null in samples; the user bears the legal basis for personal data | [Apify [1P]](https://apify.com/compass/crawler-google-places) (fetched Nov 2026) |
| **D7 Lead Finder** | Starter $44.99, Agency $54.99, Professional $119.99 a month; no trial, month-to-month (third-party; figures conflict) | Simple, fast | Outdated data, poor support, only keyword and location filters | [Saleshandy [Vendor]](https://www.saleshandy.com/blog/d7-lead-finder-pricing/) (2026) |
| **Construction Monitor** | Single-jurisdiction monthly purchase online; an older example was LA at $96 a month, $540 for six months or $960 a year **(older, undated)** | Daily permit updates (claim) | — | [JLC](https://www.jlconline.com/business/sales-marketing/pulled-permits-as-a-source-of-leads/); [CM shop](https://shop.constructionmonitor.com/) |
| **ConstructConnect / Dodge** | ConstructConnect Starter about **$129/mo per market**, Professional from **$199/mo per market** (annual). Dodge quote-only; one listing says $300/user/mo (unverified) | Project bid intelligence | "Per-user subscription fees can add up fast for smaller construction firms"; slow support | [ConstructionBids.ai](https://constructionbids.ai/blog/dodge-vs-constructconnect-comparison); [SelectHub](https://www.selecthub.com/construction-bidding-software/constructconnect-vs-dodge-data-and-analytics/) (2026) |
| **ATTOM** | Basic Property API "start at $500 per month"; building permits "available as add-on" | 300M+ permits | No published permit price | [ATTOM pricing [1P]](https://www.attomdata.com/solutions/delivery/property-data-api/pricing/) |
| **BuildZoom data** | Sales-gated (email partnerships@buildzoom.com); no public price | 350M+ permits, licensed contractors | No self-serve | [Supergood API report](https://supergood.ai/api-report-card/buildzoom) |
| **DataLane** | Quote-only | Olo connect rate 5% → 15%; ShopMonkey about 30% → above 80% | — | [Amplify](https://amplifypartners.com/blog-posts/announcing-datalane-building-the-data-layer-for-the-local-economy) (2025-12-16) |
| **Brizo FoodMetrics** (restaurants) | Quote-only | Filters and segments | Outdated contacts (snippet) | [Capterra](https://www.capterra.com/p/10021714/Brizo-FoodMetrics/) |
| **Convex** (ServiceTitan; commercial property) | Quote-only | JAN-PRO: 26% of leads, $125K retained ACV over two years | Slow map, cumbersome campaigns | [ServiceTitan](https://www.servicetitan.com/blog/success-story-jan-pro-convex) (2026-09-18) |
| **Apollo / ZoomInfo seats** | Apollo $49 to $119 or $59 to $149 per seat per month (sources conflict). ZoomInfo commonly $15K to $40K a year, or "starts at $15K/year for up to 5,000 credits" (competitor claim) | Mid-market coverage | Weak on SMB owners [P]: "both tools build on LinkedIn scraping, so both fall off on small business owners" (vendor) | Sibling note `data_enrichment_layer.md`; [Fairground/Orbital SMB comparison [Vendor]](https://withorbital.com/data/cold-call-list-builders-smb) |
| **Data Axle (formerly Infogroup) Reference Solutions / Salesgenie** | Quote-based; no trial on Reference Solutions | "Easy to find small business information to get leads" (old G2 review) | Pricing opacity, "limited small business suitability" (aggregator) | [SpotSaaS](https://www.spotsaas.com/product/data-axle-reference-solutions/pricing) (May 2026) |

### People cost
- **SDR (Bridge Group 2025, 351 B2B companies).** Median OTE "$80K Unchanged since 2022", "$55K base / $25K variable". Ramp "3.0 mo". Tenure "1.9 yrs". "60%" of reps at quota, "Lowest reported in study history". [Bridge Group](https://www.bridgegroupinc.com/research/2025-sdr-models-metrics-report-the-bridge-group) (2025-02-06)
- **Fully loaded cost.** "~$160k all in" (r/sales, ~2026-01).
- **Restaurant SaaS SDR.** Owner.com "$75,000 CAD OTE" (job post, removed 2026-03-02).
- **Offshore HVAC SDR.** "$200 USD / month" base plus $30 per qualified meeting (2026-05-19).
- **Manual research cost (vendor estimate).** "20 hours per week" of rep research, valued at $26,000 a year at $25/hr. The vendor claims Shovels + Clay at "under $500 monthly" ([Shovels CEO blog [Vendor]](https://www.shovels.ai/blog/how-to-supercharge-lead-generation-with-shovels-api-and-clay/), 2025-06-07). Note: its claimed "87%" saving does not follow from its own numbers, which give about 77%.

### Implied willingness to pay (inference, not a quote)
- A 5 to 200 person seller already stacks $150 to $1,000 a month of data (Openmart, Shovels or Clay), plus scrapers, plus at least one $80K to $160K SDR.
- One product that replaces the stitching and saves hours of SDR research a week can price in the **$300 to $1,500 a month per team** band.
- An outcome alternative exists at **$450 per held meeting** (Fairground Direct), which anchors the value of a booked meeting.

---

## 5. Objections to adopting an AI prospecting tool, with counters

| # | Objection | Evidence it is real | Counter (and evidence) |
|---|---|---|---|
| 1 | **"The data will be wrong. Emails bounce, owners are stale."** | "Google Maps emails are fake 40% of the time" (r/DigitalMarketing, ~2026-04). "more holes than hits" (Outscraper review, 2026-10-27). "Businesses change names or owners faster than Google updates their pins" (~2026-04). | Verify every contact before a draft is shown. Show the source and freshness of each field. Prefer the phone number on the Google Business Profile: "Contractors maintain accurate Google Maps listings because they need service calls" (Regency/Clay). Charge only for verified contacts, as Openmart does ("Export: 1 credit per 20 leads, only when a verified email or phone is included"). Report connect rate, not volume: DataLane's pitch is Olo going from 5% to 15% connects. |
| 2 | **"We already have Apollo, ZoomInfo or Clay."** | Clay is widespread (35k Slack members). Apollo is cheap. | LinkedIn-based tools miss owners: "We never would have been able to do that in Zoominfo" (Regency). Clay itself: "Most B2B databases have a large gap… HVAC technicians, salons, and restaurants." Leadbay customer [V]: "We found in 10 minutes on Leadbay what we couldn't find in 6 months with Clay and a GTM agency" ([Pulse 2.0](https://pulse2.com/leadbay-4-3-million-raised-to-qualify-digitally-scarce-smb-leads/), 2026-05-20). Clay's API and CRM sync need Growth ($446+/mo) or Enterprise and someone to build tables. Position as complement plus CRM: keep Apollo for mid-market and import Clay tables. |
| 3 | **"AI outreach will spam our market and hurt the brand and deliverability."** | Owners: "Don't waste your time sending me cold emails…" (Mike Wang). "Everyone is using AI to write generic I saw your business on Maps messages" (~2026-04). Gmail: "Keep spam rates… below 0.10% and avoid ever reaching a spam rate of 0.30% or higher" ([Google](https://support.google.com/a/answer/81126), fetched Nov 2026). | A human approves every message by design. Use fewer, trigger-specific touches: "50 emails with 3 "interested" replies beats 200…" Put the real trigger in the first line (the permit address and type). Default to phone and SMS-free call lists for trades ("Plumbers don't check email during the work day"). Rate-limit per domain. |
| 4 | **"AI SDRs don't work."** | TechCrunch on 11x [V]: "We were losing 70-80% of customers that came through the door"; "The actual results of the amount of automated emails versus meetings booked was disappointing" ([TechCrunch](https://techcrunch.com/2025/03/24/a16z-and-benchmark-backed-11x-has-been-claiming-customers-it-doesnt-have/), 2025-03-24). r/sales: "Personalization does not equal relevance." | Don't sell autonomy. Sell the research-and-list-building hours ("Two hours for maybe 40 usable contacts"; vendor estimate of "20 hours per week") and the trigger. The seller stays the sender. Price per seat or usage, not a large annual AI SDR contract. |
| 5 | **"Is this legal and compliant?"** | **Google Maps ToS** 3.2.3(a) [V, as quoted by a third party]: "Customer will not export, extract, or otherwise scrape Google Maps Content for use outside the Services." ([macmyths](https://macmyths.com/how-to-build-a-google-maps-scraper-and-what-to-use-instead/), 2026-10-04). Google has cited 3.2.3 to restrict a project ([Bubble forum](https://forum.bubble.io/t/google-maps-violation/194549)). **Places caching:** only place IDs may be stored indefinitely; coordinates up to "30 consecutive calendar days" ([Google](https://developers.google.com/maps/documentation/places/web-service/policies)). **Texas SB 140** (effective 2025-09-01) adds texts to "telephone solicitation" with a private right of action ([Morgan Lewis](https://www.morganlewis.com/pubs/2025/09/texas-telephone-solicitation-law-now-covers-text-messages)). Reddit: "Scraping and selling business contact data can fall into gray areas depending on how it's used." (r/Kenya, ~2026-03-01). | Use the official Places API with attribution, store `place_id` and refresh rather than keep scraped copies. Use government open data and bulk files for permits, SOS filings and FMCSA. No automated texts. Every email has an opt-out (CAN-SPAM). Keep an audit trail of where each fact came from. B2B targets (the contractor or business) rather than homeowners. |
| 6 | **"Permit data is too stale to matter."** | "three to four weeks after approval… A fast remodel may already be locked up" (NRLA, 2026-07). Shovels refreshes monthly (directory). | Use permits for **contractor velocity** (who is busy, trailing 90 days to 12 months) rather than single-job chasing. Layer faster signals (Places `FUTURE_OPENING`, liquor applications, SOS daily files). Results exist despite the lag: PARR ">$1 million in new sales in their first year"; 61HAWK "hundreds of qualified leads" in about 6 days. |
| 7 | **"Our buyers only buy through referrals or in person."** | "Plumbers and HVAC guys trust peer referrals almost exclusively." "A personal recommendation is far more valuable than a perfect pitch." | Bots build territory and walk-in lists and event follow-ups. Map contractor relationships from co-permits ("if we make friends with one contractor, all of a sudden we have 100 installs", 61HAWK). Find referral paths, not only cold targets. |
| 8 | **"Ethics: we'd be poaching other people's projects."** | r/solar [V]: "permit scraping sits in this gray zone where it's not technically illegal in most places, just aggressively competitive." / "using it to intercept active projects crosses an ethical line imo." ([reddit](https://reddit.com/r/solar/comments/1tprog6/energy_service_partners_phum_tomthong_allegedly/) · [mirror](https://reddit.sentinel-team.org/posts/1tprog6/snapshots/2026-05-28T08%3A25%3A20.903145Z), ~2026-05-28) | Target the **contractor or business** that pulled the permit (B2B), not the homeowner mid-project. Make homeowner targeting off by default. |
| 9 | **"We don't have RevOps or GTM-engineer time to set it up."** | Clay workflows need HTTP connections, formula columns and waterfalls (Shovels + Clay guide). | Vertical templates ("HVAC contractors with 20+ permits in the last 90 days in my territory"). The setup is a sentence, not a table. |

---

## 6. Disqualifiers

### Takeaway
The fit is a B2B seller with a defined US territory, a phone-and-email outbound motion and an ACV that justifies research. Disqualify the following.

1. **Sellers mainly to homeowners or consumers** (residential solar or roofing door-knocking, home-improvement B2C). Permit-poaching ethics (r/solar), TCPA and state text laws (Texas SB 140), and our B2B data model all point away. *Exception:* the commercial lines of the same companies.
2. **No outbound motion.** Inbound-only or product-led growth with no SDR or AE, e.g. a "warm inbound leads" SDR role ([Owner.com post](https://builtin.com/job/sales-development-representative-toronto/4499800)). These teams will not use prospect-finding Bots.
3. **Enterprise-only targets** (chains, enterprise GCs, health systems). LinkedIn-based data works there, and Dodge or ConstructConnect cover large commercial projects.
4. **Very large outbound orgs that already license or build local data.** Example: DoorDash built internal data infrastructure, then bought DataLane ([Amplify](https://amplifypartners.com/blog-posts/announcing-datalane-building-the-data-layer-for-the-local-economy)). They buy data feeds, not an SMB CRM. This is out of the 5 to 200 employee band anyway.
5. **Markets outside the US.** Permits, SOS filings, FMCSA, Shovels and BuildZoom are US sources. Non-US demand exists (the Kenya Google Maps scraper thread), but our data sources do not.
6. **Needs real-time triggers on fast jobs.** If the window closes in days (fast remodels), the 3 to 4 week permit lag kills the value unless other signals cover it.
7. **Wants fully autonomous mass sending** and refuses an approval step. Spam-rate risk; this is the 11x churn pattern.
8. **ACV too small to justify researched outreach** (inference). Tools sold at about $50 a month ("Charge for the pilot, even $50/mo", r/SaaS) cannot carry about $0.24 per owner phone plus research and SDR time. Prefer an ACV above about $1,500 a year, or high-volume self-serve motions where the Bot only builds call lists.
9. **Verticals with no public-record footprint** (online-only or remote businesses). Without Maps listings, permits or licenses the Bots have nothing to watch.

---

## 7. Examples: named companies that describe permit-based or public-record prospecting

| Company | Type | What they do | Result / quote | Source (date) |
|---|---|---|---|---|
| **PARR Lumber** | Building-materials dealer (Pacific NW) | Works permit-based opportunities in the SalesJack CRM | "closed more than $1 million in new sales in their first year working permit-based opportunities" [V, vendor-sponsored] | [NRLA/SalesJack](https://nrla.org/how-permit-data-and-ai-help-lumberyards-win-more-business/) (2026-07); [LBM Journal](https://www.lbmjournal.com/resources/partner-content/article/15816673/sales-jack-from-permits-to-profit-how-ai-is-driving-real-sales-growth-at-parr) |
| **Hamilton Building Supply, HPM Building Supply, Evanston Lumber, Schillings** | LBM dealers | Named SalesJack users [P] | — | [destinationCRM](https://www.destinationcrm.com/Articles/CRM-News/CRM-Across-the-Wire/SalesJack-Launches-Radar-and-Major-CRM-and-Mobile-App-Upgrades-176313.aspx) |
| **Gunton Corp (Pella distributor)** | Windows and doors supplier | Reps "Regularly visit permit offices or review permit reports" | Job post | [Paylocity](https://recruiting.paylocity.com/Recruiting/Jobs/Details/3476518) (fetched Nov 2026) |
| **Regency Supply** | Commercial lighting and electrical distributor | Clay Google Maps integration to find electrical contractors by region, then phone outreach. Tracks 5,000+ contacts for job changes | "Contractors maintain accurate Google Maps listings because they need service calls." | [Clay](https://clay.com/customers/regency-supply) (undated) |
| **JAN-PRO of Northwest Florida** | Commercial cleaning franchise | Convex property filters and building-owner contacts in place of Google Earth and driving the territory | 26% of leads; $125,000 retained annual contract revenue over two years; 18% of signed agreements. "You scroll down, there's the owner of the building." | [ServiceTitan](https://www.servicetitan.com/blog/success-story-jan-pro-convex) (2026-09-18) |
| **TALTEK Commercial Roofing** | Commercial roofer (15 SE states) | Uses Convex for building intelligence and new opportunities [P] | — | [ServiceTitan webinar recap](https://www.servicetitan.com/blog/webinar-recap-unlocking-the-full-power-of-convex) |
| **Boldr** | HVAC thermostat company | Shovels API to find mini-split installers (contractor network) and recent installs | "Shovels provides us with actionable insights that we couldn't efficiently gather before." | [Shovels](https://www.shovels.ai/blog/case-study-boldr/) (2025-08-11) |
| **61HAWK** | Ad agency selling automated parking systems | Shovels' Charlie agent over Claude MCP to find stacked-parking permits; pivoted to the licensed contractors | "Hundreds of qualified leads", about 6 days to a working system | [Shovels](https://www.shovels.ai/blog/case-study-61hawk/) (2026-01-28) |
| **Copper; Tactical Rebates** | Electrification and solar-incentive (B2C) | Shovels API to target permit-holding homeowners (Copper: direct mail to 4,036 households) | B2C, so outside our B2B ICP | [Shovels blog index](https://www.shovels.ai/blog) (2025-05 / 2025-08) |
| **Thumbtack** | Home-services marketplace | Shovels license data to verify pros | Verification, not prospecting | [Shovels](https://www.shovels.ai/blog/thumbtack-case-study/) (2026-07-28) |
| **Olo, ShopMonkey, DoorDash** | Restaurant SaaS, auto-shop SaaS, marketplace | Buy DataLane local-owner data | Olo SDR connect rate 5% → 15%; ShopMonkey about 30% → above 80% | [Amplify](https://amplifypartners.com/blog-posts/announcing-datalane-building-the-data-layer-for-the-local-economy) (2025-12-16) |
| **Housecall Pro, Podium, FieldPulse, WebPT, Xplor, EverCommerce, Maple, Archy, Skimmer, Angi, Scorpion, Belfry, GreenSpark…** | Vertical SaaS and services selling to SMBs | Logos on Fairground (formerly Orbital), which sells owner data and outsourced meetings | Logos only, no stories | [Fairground](https://fairground.run/?utm_source=orbital&from=orbital) (fetched Nov 2026) |
| **Trucking-insurance agencies** | Insurance | FMCSA new-authority feeds (Truckr, Apify actors) | Category-level, no named agency | [G2 Truckr](https://www.g2.com/sellers/truckr) |
| **Solar ecosystem (700+ companies)** | Utilities, OEMs, distributors, installers | Ohm Analytics permit and interconnection intelligence | Older sources (2017–2020) | [Solar Academy](https://solaracademy.com/powering-growth-real-time-analysis-of-the-u-s-solar-market/) |

Not found in this pass: a Clay case study from a field-service, restaurant or salon vertical SaaS company. Shovels' blog has no named vertical-SaaS customer selling *software* to contractors via permits. Boldr is the closest.

---

## 8. Competitors offering AI prospecting from local or public-record data

### Takeaway
Funded players own **data** (DataLane, Fairground, Openmart, Leadbay, Shovels) or **vertical CRMs** (SalesJack for lumber dealers, Convex for commercial services).
- Openmart is the nearest to "Bots that find, research and draft".
- Shovels is the nearest on permits, with an AI agent.
- No one combines multi-source public-record triggers, research, drafts and seller approval inside a horizontal CRM for 5 to 200 person sellers.

| Competitor | What it does (data and AI) | Price | Funding / traction | Threat |
|---|---|---|---|---|
| **DataLane** | AI identity graph of US local businesses; owner mobiles; "more than two billion real-time data points" (claim) | Quote-only | **$22.5M Series A, Dec 2025** (Amplify; 20VC, Basis Set, Mischief); about $27M total | High as a data layer, likely a partner rather than a CRM. [Amplify](https://amplifypartners.com/blog-posts/announcing-datalane-building-the-data-layer-for-the-local-economy); [Pulse 2.0](https://pulse2.com/datalane-22-5-million-series-a/) |
| **Fairground** (formerly Orbital) | "30M+ local businesses"; owner mobiles and emails; "live buying signals"; MCP/API; plus done-for-you meetings | Direct from **$450 per held meeting**; Data free starter, paid usage-based (unlisted) | Not found | High. Same buyers (Housecall Pro, Podium, FieldPulse). [Fairground](https://fairground.run/pricing) |
| **Openmart** (YC W24) | AI-scraped local-business DB from filings, maps and reviews; owner finder; **"Openclaw for sales" agent finds, scores, drafts outreach**; sequencing; API | Free / **$149** ($105 annual) / **$299** ($209) / Enterprise | **$2.75M seed (Aug 2024)**; a $15.2M total appears on aggregators but is unverified | **Highest feature overlap.** [Openmart](https://www.openmart.com/pricing); [TechCrunch](https://techcrunch.com/2024/08/21/openmart-wants-to-make-it-easier-for-enterprises-to-sell-to-local-businesses) |
| **Leadbay** (YC F25) | AI inference to find and qualify "digitally scarce" SMBs (construction, hospitality, retail); learns the ICP | Free 50 leads; otherwise unlisted | **$4.3M seed, 2026-05-20** (YC, Roosh) | Medium-high. [Pulse 2.0](https://pulse2.com/leadbay-4-3-million-raised-to-qualify-digitally-scarce-smb-leads/); [YC launch](https://www.ycombinator.com/launches/OdJ-leadbay-ai-3x-more-smbs-than-linkedin-qualify-the-99-you-miss-with-clay) |
| **Shovels** | Permits, contractors, properties, residents, employees; Charlie AI agent; API, CLI, Sheets; distributed via Clay, Esri, Precisely, Regrid, Cherre; acquired ReZone (local government meetings), Jan 2026 | Free / **$599** / **$999** / Enterprise | **$5M seed (June 2025, Base10)**; about $6.5M total; **about $3M ARR Aug 2026** (Sacra est.) | Partner (data source) more than rival; could move up-stack. [Shovels](https://www.shovels.ai/pricing); [Sacra](https://sacra.com/c/shovels/) |
| **SalesJack** | CRM for lumber yards and building-materials dealers; permit data matched to the dealer's ERP; "Radar" AI | Not public | Founded 2023; funding unclear | A vertical proof that "permits + CRM + AI" sells. [destinationCRM](https://www.destinationcrm.com/Articles/CRM-News/CRM-Across-the-Wire/SalesJack-Launches-Radar-and-Major-CRM-and-Mobile-App-Upgrades-176313.aspx) |
| **Convex** (ServiceTitan) | Commercial property intelligence (about 6M properties): permits, ownership, tenants, contacts; "Signals" intent | Quote-only | Inside ServiceTitan | High for commercial HVAC, roofing and cleaning. [GetApp](https://www.getapp.co.uk/software/2078758/convex) |
| **Building Radar** | AI tracking of construction projects for construction-product sales teams | Not public | $7.2M (Oct 2024) **(older)** | Medium (EU-heavy, larger projects). [tech.eu](https://tech.eu/2024/10/08/building-radar-secures-7-2m-to-expand-its-sales-software-internationally/) |
| **Origami** (YC) | AI research agents crawling Google Maps, job posts and websites for niche lists; early customers in property management | Directory says Free / $29 / Custom (unverified) | **$2M seed** (date not captured), "$0 to $50k MRR in its first 50 days" (company claim) | Medium. [VentureBeat](https://venturebeat.com/ai/y-combinators-hottest-startup-origami-agents-secures-2m-seed-round-to-supercharge-sales-teams-with-ai) |
| **Clay** | Google Maps source, Claygent, SMB enrichment recipe, waterfall | $167 to $446+ a month | Large and well funded | Incumbent workflow; integrate rather than fight. [Clay](https://clay.com/blog/google-maps-lead-generation-for-niche-leads) |
| **BuildZoom / Construction Monitor / ATTOM / ConstructConnect / Dodge / Ohm Analytics / Brizo** | Permit, project, property or foodservice data | See §4 | Brizo C$12M Series A **(older, 2023)** | Data sources, not agents |
| **Outscraper / Apify / D7 / LeadSwift / WebLeads** | Google Maps scrapers, some with owner enrichment | $1 to $3 per 1,000; D7 $45 to $120 a month | — | Cheap substitutes, and ToS-exposed |
| **Apollo / ZoomInfo** | General B2B data plus AI | See §4 | — | Weak on owners; buyers already pay for them |

---

## Gaps and what was not verified
- **No LinkedIn posts** could be retrieved. A manual LinkedIn search is needed for that channel: "permit data" + outbound, "selling to SMBs" + "not on LinkedIn".
- **r/HVAC, r/Roofing and r/smallbusiness** threads on vendor outreach were not found through search. r/solar was found (the permit-poaching thread).
- **Pricing not found or not fetched:** SafeGraph or Advan, Enigma, Cobalt Intelligence (SOS API), current Data Axle, Dodge list price, DataLane, Fairground paid Data tiers, LeadSwift (its pricing page returned HTTP 500).
- **Funding not found:** Fairground (Orbital); SalesJack (a Caplight headline about a $16M Series A could not be tied to SalesJack).
- **Origami's** seed date was not captured.
- **Trade shows not checked:** AHR Expo, International Roofing Expo, RE+, ISSA, IBS.
- **Job posts.** Several (AccuLynx "75+ outbound cold calls", Hireframe "10–50+ employees", Restaurant365) were seen only in search snippets, and some posts are closed.
- **Reddit quotes** come from the `reddit.sentinel-team.org` archive mirror, not live Reddit. Re-check them on reddit.com before quoting externally.
