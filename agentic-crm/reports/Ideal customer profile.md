# Ideal customer profile

> **Grounding:** 105 verbatim buyer quotes gathered on 2026-11-10, mostly dated 2025 to 2026. That is 48 from small bidding contractors, 28 from tech companies selling to government and 29 from companies selling to local businesses. Sources:
> - congressional testimony
> - Trustpilot and review-site reviews
> - Hacker News
> - Reddit, read through an archive mirror
> - buyer-written job posts
>
> Other evidence:
> - 105 open OnlineJobs.ph listings matching "sam.gov", about 30 of them posted August to November 2026.
> - A pull of FY2025 small-business winners by trade NAICS code from USAspending.
> - Competitor customer bases and pricing: Bid Banana, HigherGov, GovTribe, GovSpend, GovWin IQ, ConstructConnect, Starbridge, GovDash, Openmart, Shovels, DataLane, Fairground.
>
> The notes are in [`research_notes/Ideal customer profile/`](../research_notes/Ideal%20customer%20profile/).
>
> **Limits:**
> - Reddit and LinkedIn were blocked for Segments A and B, so A has no Reddit quotes.
> - Many quotes were pulled out by a page-fetch step. Spot-check a quote before using it in external copy.
> - Offers and prices below are provisional until the offers are designed.

## The answer

**Our ideal customer is the owner of a small trades or facilities company that already wins public contracts:**
- **Trade:** janitorial, landscaping, HVAC and plumbing, painting, roofing or moving.
- **Size and place:** 1 to 50 employees, in the US.
- **Registration:** an active SAM.gov registration.
- **Public work:** $50K to $5M a year in federal, state or local awards.

The owner either finds and writes bids personally, at 8 to 40 hours a proposal, or pays an offshore assistant $3 to $12 an hour to do it. The assistant searches portals, reads solicitations, chases subcontractor quotes and tracks deadlines. That job description is what Magpie's Bots do, and the owner approves by text.

Two larger segments come next. Both reuse the same engine:
- **B:** founder-led tech companies selling to government.
- **C:** companies whose sales teams sell to local businesses.

---

## Segment A: Owner-operated trades contractors who bid public work (→ Offer 1: Bid Desk, $149 a month per business)

| Dimension | Detail |
|---|---|
| **Who** | **Role:** owner or president of a US small business, often also its estimator.<br>**Trade codes (NAICS):** 561720 janitorial, 561730 landscaping, 238220 plumbing and HVAC, 238320 painting, 238160 roofing, 484210 moving.<br>**Size:** 1 to 50 employees.<br>**Work:** bids federal plus state, county and city work. Often holds or has just earned an SBA certification (8(a), WOSB or EDWOSB, HUBZone, SDVOSB).<br>**Search query:** USAspending recipients in those codes with $50K to $5M of FY2025 obligations, joined to an active SAM.gov registration. |
| **Firmographics** | **Revenue band:** $50K to $5M a year in public awards. Median FY2025 small winner: janitorial $46,750, landscaping $50,709, HVAC and plumbing $71,098. Between 71% and 80% of small winners in these trades received under $250K.<br>**Market:** FY2025 small federal winners alone: 1,078 janitorial, 1,124 landscaping, 1,416 HVAC and plumbing, 335 roofing, 158 painting, 180 moving. That is out of 56,725 small federal prime winners, and the same firms also bid state and local work.<br>**Stack:** SAM.gov, free agency portals, a spreadsheet bid calendar, email and phone, sometimes Bid Banana, HigherGov Starter or BidNet.<br>**Maturity marker:** at least one award (past performance) and active bidding in the last 12 months.<br>**Funding source:** the money now spent on an offshore assistant, or the owner's evenings. |
| **Pain (their words)** | "It is somewhere between 8 and 40 hours of my time, and that doesn't include the time of my employees" (Sue Tellier, owner, JetCo Federal, [House hearing](https://www.govinfo.gov/content/pkg/CHRG-119hhrg61897/html/CHRG-119hhrg61897.htm), 2025-09-10)<br>"I must have some degree of confidence that I have a chance at winning an opportunity to justify pursuing it." / "I am not going to waste the time bidding." (Tellier, same hearing)<br>"Federal solicitations are often too unclear, inconsistent, and overly complex." (Michael Ramos, Raymond Global, same hearing)<br>"Monitor federal, state, local, and corporate procurement portals daily" / "Review solicitation documents in full and extract key requirements" ([owner job post](https://www.onlinejobs.ph/jobseekers/job/Bid-Researcher-and-Proposal-Writer-1577502), 2026-09-03)<br>"Opportunities must be reviewed and approved before any supplier outreach" ([owner job post](https://www.onlinejobs.ph/jobseekers/job/SAMgov-Opportunity-Researcher-Government-Contract-Lead-Finder-1620357), 2026-04-21)<br>"Follow up persistently to get formal, signed quotes in hand before deadlines" ([Curtis Federal Solutions](https://www.onlinejobs.ph/jobseekers/job/government-contracts-sourcing-assistant-1730238), 2026-09-14)<br>"Pricing to Service Contract Act (SCA) wage determinations, including locating the correct wage determination" ([federal contractor job post](https://www.onlinejobs.ph/jobseekers/job/pricing-analyst-government-contracts-1757835), 2026-10-28)<br>"98% public, state, fed work that i can solicit for free" / "It just wasn't practical for an operation my size" ([ConstructConnect reviews](https://www.trustpilot.com/review/constructconnect.com), 2026)<br>"saving us time compared with searching multiple agency portals manually." ([BidPrime 5-star review](https://www.trustpilot.com/review/bidprime.com), 2026-05-22) |
| **Trigger events** | 1. **Posts or re-posts a job** for a SAM.gov or bid assistant, bid coordinator, proposal writer or estimator. OnlineJobs.ph had 105 open on 2026-11-10, with stable job IDs and "Date Updated" fields; Indeed and Upwork carry more. This is the strongest signal, because they already pay for the work.<br>2. **New SBA certification:** SBA Small Business Search and SAM entity data.<br>3. **First federal award, a contract nearing its end date, or a lost recompete:** USAspending API by UEI.<br>4. **Federal fiscal Q4, July to September:** about 17% of spending lands in September. Sell in May and June.<br>5. **Loss of 8(a) status in the 2025 to 2026 audits:** exit dates in SAM and SBA Small Business Search. Pitch it as "replace your pipeline", and handle it with care.<br>6. **Renewal date of a bid tool they dislike:** not visible from outside, so ask in discovery. Reviews cite auto-renew traps. |
| **Watering holes** | **APEX Accelerators:** 92 free, DoD-funded centers reporting 26,232 new clients (release date unconfirmed). Some sell a "Bid Match" service, so treat them as a channel or partner.<br>**GovCon Giants** (Eric Coffie): 909 podcast episodes, a 4,000+ member paid community and a chamber partner program at $49 a month. It reports 49K YouTube subscribers itself.<br>**Reddit** (tracker sizes): r/GovernmentContracting about 49K, r/sweatystartup about 208K, r/lawncare about 967K, r/smallbusiness about 2.4M.<br>**Government and education:** SBA district offices, SubNet and Mentor-Protégé; PilieroMazza and SmallGovCon webinars; NALP's The Edge (government contracting articles for landscapers).<br>**Where they act:** OnlineJobs.ph job posts; Trustpilot reviews of ConstructConnect, BidPrime and GovSpend, which mark switchers; Product Hunt launches of $25 to $29 a month SAM.gov tools. |
| **Budget behavior** | **Tools:** Bid Banana $49.99/mo; HigherGov $500/yr; BidNet $599 to $1,999/yr; GovTribe $1,900 per seat per year; ConstructConnect $129/mo per market; GovCon Giants $149/mo or $997 once.<br>**Labor:**<br>- Offshore assistant $3 to $12 an hour, $400 to $1,500 a month full time.<br>- US bid coordinator about $61,810 a year.<br>- One in-house proposal 20 to 100 hours, about $600 to $3,000 of labor.<br>**Beginners** pay $599 to $8,300 to registration services such as USFCR. That marks the too-small tier.<br>**Read:** $50 to $250 a month for tools, up to $1K to $3K a year when the tool replaces labor. Month-to-month billing is a buying criterion, and they will not pay GovWin prices.<br>**Offer check:** at COGS.md's $0.10 a run, 300 runs is about $30 of AI, so $149 keeps a margin near 70% (my calculation). |
| **Objections** | **"The bids are free on SAM.gov."** Sell the labor saved (reading, pricing, subcontractor quotes, drafting, follow-up), not the data. Show the hours replaced next to what their assistant costs.<br>**"AI makes things up, and proposals get rejected."** GAO dismissed protests built on AI-fabricated citations (2025-09-25), and some 2026 solicitations ban AI or require disclosing it. The counter:<br>- Every requirement and price links to the page it came from.<br>- The owner approves before anything goes out.<br>- The Bot flags AI clauses and offers a no-AI-drafting mode, with a log of what AI drafted.<br>**"Another tool that traps me, or a scam."** Reviews complain about auto-renewals, and a GovCon Giants episode covers an "$8,000 software and we'll send you contracts" scheme. The counter:<br>- Month-to-month billing, with cancel in the app.<br>- No "guaranteed contracts" claims.<br>- A free first bid package.<br>- Endorsement through APEX or community partners.<br>**"I don't have time to learn software."** There is no dashboard to learn: a daily text digest, and approve by replying. |
| **Disqualify if** | **Not ready:** no active SAM.gov registration, no trade revenue, or has never bid. They buy hope, then churn.<br>**Pass-through broker:** a side-hustle broker planning to subcontract all the work, which breaks the FAR 52.219-14 limits (50% for services, 85% for general construction, 75% for special trades).<br>**Too big:** already pays for GovWin, GovSpend or GovDash, has a capture or proposal team, or wins more than $5M a year in the trade.<br>**Security burden:** CUI-heavy DoD IT work needing CMMC Level 2.<br>**Wrong workflow:**<br>- Bids only on private general-contractor invites through BuildingConnected, so there is no searching to automate. Pricing Bots may still fit.<br>- High-volume DIBBS line-item resellers, a different workflow worth testing separately.<br>**At risk:** 8(a) firms currently suspended. |

---

## Segment B: Founder-led tech companies selling to government (→ Offer 2: Public-Sector Pipeline, $1,000 a month per team)

| Dimension | Detail |
|---|---|
| **Who** | **Role:** the founder or first public-sector seller (founding government AE, capture manager or proposal manager).<br>**Company:** a US tech company of 5 to 50 people selling software or hardware to state and local government or schools, or to DoD and civilian agencies through SBIR/STTR and OTAs. It does not handle CUI.<br>**Search:** SBIR.gov and USAspending awardees for FY2025 to FY2027; GovTech and defense investor portfolios (Govtech Fund, Craft, Menlo, Shield Capital, YC); job posts for "founding government AE", "capture manager" and "proposal manager". |
| **Firmographics** | **Stage:** seed to Series B, founder-led, VC-funded with a public-sector or dual-use thesis. Defense-tech VC was a record $49.1B in 2025.<br>**Stack:** HubSpot or Salesforce, plus HigherGov or GovTribe. Sometimes GovRAMP or FedRAMP in process.<br>**Market:** FY2024 SBIR/STTR made 6,444 awards worth $4.35B. AFWERX has a 3,379-company portfolio, 45% of them new to government. There are 90,837 US local governments.<br>**Funding source:** the sales budget that would otherwise go to consultants or a $140K to $200K capture hire. |
| **Pain (their words)** | "I lost days deciding which federal opportunities to pursue and weeks assembling teams, researching competitors, pricing work, checking compliance, negotiating with subcontractors, and writing proposals." (2x defense founder, [Hacker News](https://news.ycombinator.com/item?id=49442327), 2026-08-25; the author now sells a competing tool)<br>"Pursuing poor-fit opportunities, or being disqualified over technicalities, consumed runway and pulled me away from engineering." (same post)<br>"with a team of three people working in a garage, I did not have time to write a hundred-page proposal." (Caleb Carr, CEO, Vita Inclinata, [Senate hearing](https://www.govinfo.gov/content/pkg/CHRG-119shrg59474/html/CHRG-119shrg59474.htm), 2025-03-05)<br>"The largest barrier to participation in the program for new entrants is increased administrative burden and complexity of proposal submission." (Bill Marinelli, CEO, Physical Sciences Inc., [House hearing](https://www.govinfo.gov/content/pkg/CHRG-119hhrg58905/html/CHRG-119hhrg58905.htm), 2025-02-26)<br>"When I set up a very specific search, I still end up getting too many unrelated items emailed to me." ([GovWin IQ reviewer](https://softwarefinder.com/sales-tools/govwin-iq), September 2026)<br>"I'm unsure if the juice is worth the squeeze." (small tech company weighing an SBIR topic, [Ask HN](https://news.ycombinator.com/item?id=48579256), 2026-06-18)<br>"The SBIR program isn't your customer, it's funding." ([Hacker News](https://news.ycombinator.com/item?id=48579385), 2026-06-18)<br>A founding AE post at an 8-person company requires "setting up and operating Customer Relationship Management (CRM) systems" ([Emerge Career](https://builtin.com/job/founding-govt-account-executive/9167732), 2026) |
| **Trigger events** | 1. **New SBIR/STTR Phase I or direct-to-Phase II award:** SBIR.gov bulk data and USAspending. The programs restarted in April and May 2026 after reauthorization, and awards follow 3 to 9 months later, so new awardees keep arriving through 2027.<br>2. **Hiring a first public-sector AE, capture manager or proposal manager:** Greenhouse, Lever, Ashby, Built In and VC job boards.<br>3. **A funding round with a public-sector or dual-use thesis:** SEC Form D filings and press.<br>4. **A new GSA schedule, cooperative contract, or GovRAMP or FedRAMP status:** GSA eLibrary, NASPO and Sourcewell lists, the FedRAMP Marketplace.<br>5. **Accelerator or AFWERX selection; state budget adoption** (46 states start their fiscal year on July 1); **incumbent contract end dates.**<br>6. **CMMC Phase 2 in solicitations from 2026-11-10:** this pushes some firms toward subcontracting. |
| **Watering holes** | **Defense programs and accelerators:** AFWERX and SpaceWERX; Griffiss HUSTLE, Catalyst Accelerator, CRP DefenseTech, SDA TAP Lab, NATO DIANA.<br>**State and local government events:** Code for America Summit, NASCIO, GovAI Coalition Summit (2026-12-09), NLC City Summit (2026-11-19), GovRAMP Cyber Summit (2026-11-15).<br>**Defense events:** AUSA, AFA, I/ITSEC (2026-11-30).<br>**Investors and community:** CivStart; Govtech Fund; podcasts such as Mission Matters, The Merge and The Defense Tech Underground; Hacker News Ask and Show threads.<br>**Networks:** LinkedIn, ClearanceJobs, GovConNet. |
| **Budget behavior** | **Tools:** HigherGov $500 to $2,500/yr; GovTribe $1,200 to $2,100 per seat per year; GovSpend median $11,576/yr; GovWin average about $29K/yr; HubSpot Pro $90 a seat plus $1,500 onboarding.<br>**Outside help:** consultants $150 to $300 an hour; SBIR advisors $3K to $7.5K a month plus 3% to 7% of the award; a Phase I proposal $5K to $20K.<br>**Hiring:** a capture hire is $140K to $200K base.<br>**Read:** a 10-person firm spends about $20K to $25K a year before any hire, so a Bot CRM fits at $500 to $2,000 a month. |
| **Objections** | **Security, CUI and CMMC.** Competitors claim FedRAMP Moderate or an equivalent. The counter: start with state and local sellers and SBIR-only firms that handle no CUI, get SOC 2, and publish a data-handling statement.<br>**Model provenance.** The Pentagon reportedly designated Anthropic a supply-chain risk, a designation upheld on 2026-09-25. The counter: a per-workspace model policy that can exclude a provider, plus a written statement of which models are used.<br>**"We already run HubSpot or Salesforce."** The counter: two-way sync, or running on top of their CRM as Day AI does.<br>**"Starbridge or GovDash already do this."** Starbridge already offers compliance matrices and AI proposal writing. The counter:<br>- Target founder-led teams of 5 to 50.<br>- Run one loop (find, qualify, draft, approve) in Slack.<br>- Price below their enterprise contracts. |
| **Disqualify if** | **Too big:** a prime or mid-tier contractor with its own capture team, or a firm over 500 employees (not eligible for SBIR).<br>**Already covered:** a repeat SBIR winner with in-house writers.<br>**Security gate:** classified or CUI-heavy work, until we reach FedRAMP Moderate or an equivalent.<br>**Wrong model:** services and staffing contractors; firms that sell only through resellers or primes; non-US-owned firms. |

---

## Segment C: Sales teams whose customers are local businesses (→ Offer 3: Territory Bots, $600 a month per team)

| Dimension | Detail |
|---|---|
| **Who** | **Role:** head of sales, SDR manager or founder at a US company of 5 to 200 people whose customers are local businesses.<br>**Company types:**<br>- Vertical software for trades, restaurants, clinics and salons.<br>- Building-material dealers and electrical distributors.<br>- Commercial cleaning, roofing and HVAC service sellers.<br>**Motion:** SDRs or AEs doing outbound calls and email by territory.<br>**Search:** SDR job posts with call quotas aimed at contractors or restaurants; customer logos on Shovels, Clay, Openmart and Fairground. |
| **Firmographics** | **Stage:** seed to growth-stage vertical software companies (FieldPulse, JobNimbus, Owner.com and Loop are examples of the type), or regional distributors.<br>**Stack:** Salesforce or HubSpot, plus Salesloft, Clay, Apollo and Google Maps scrapers.<br>**Deal size:** above about $1,500 a year.<br>**Funding source:** the SDR budget (median OTE about $80K, about $160K all-in) and data-tool spend. |
| **Pain (their words)** | "Two hours for maybe 40 usable contacts." (r/Entrepreneur, [via mirror](https://reddit.sentinel-team.org/posts/1rq5yof/snapshots/2026-03-11T23%3A24%3A49.304676Z), about 2026-03)<br>"Google Maps emails are fake 40% of the time." / "Plumbers don't check email during the work day." (r/DigitalMarketing, [via mirror](https://reddit.sentinel-team.org/posts/1sr2di9/snapshots/2026-04-21T06%3A25%3A49.004749Z), about 2026-04)<br>"We're calling small business owners who often don't have LinkedIn profiles" ([RevGenius](https://community.revgenius.com/x/chat-revops/n6vuoiftu9wu/finding-business-owner-info-tips-for-enriching-lea), 2025-04-18)<br>"Contractors maintain accurate Google Maps listings because they need service calls." / "We never would have been able to do that in Zoominfo." (Regency Supply, [Clay case study](https://clay.com/customers/regency-supply))<br>"Permit records become available three to four weeks after approval." / "Reps should get qualified opportunities, not a county spreadsheet." ([NRLA](https://nrla.org/how-permit-data-and-ai-help-lumberyards-win-more-business/), vendor-sponsored, 2026-07)<br>"Make 150-200 calls per day." ([FieldPulse SDR post](https://ats.rippling.com/fieldpulse/jobs/c0b506af-982b-4a01-a16f-1faa7d05b11c))<br>"Regularly visit permit offices or review permit reports to uncover active new projects" ([Pella distributor job post](https://recruiting.paylocity.com/Recruiting/Jobs/Details/3476518)) |
| **Trigger events** | 1. **SDR or BDR job posts** with call quotas into trades or restaurants (public applicant-tracking boards, Built In). A post that names permit offices is a stronger signal.<br>2. **Adoption of a local-data tool:** Shovels, Clay's Google Maps source, Openmart, DataLane or Fairground (their customer logos and community threads).<br>3. **A seed or Series A round** at a vertical software company.<br>4. **Expansion** into new territories or verticals. |
| **Watering holes** | **Sales communities:** Clay Slack (35K members) and Clay Clubs in 90+ cities; RevGenius; Pavilion.<br>**Reddit:** r/sales, r/coldemail, r/SaaS.<br>**Tool directories:** the GTM Directory, ColdIQ, the Apify Store.<br>**Vertical software events:** Vertical Software Summit, Vertex, SaaStr Annual.<br>**Their customers' trade shows:** ServiceTitan Pantheon (5,000+ contractors), the National Restaurant Association Show, MURTEC.<br>**Dealers:** NRLA and LBM Journal. |
| **Budget behavior** | **Data and tools:** Openmart $149 to $299/mo; Shovels $599 to $999/mo; Clay $167 to $446/mo; scrapers $1 to $3 per 1,000 places; ZoomInfo $15K+/yr.<br>**Outsourced:** Fairground charges $450 per meeting held.<br>**Read:** $300 to $1,500 a month per team for one product that replaces the stitched-together stack. |
| **Objections** | **Bad data.** Verify contacts before drafting, show each field's source and freshness, charge only for verified contacts, and report connect rate.<br>**"We already have Apollo or Clay."** Owners aren't on LinkedIn, so those tools miss them. Work alongside them, and import Clay tables.<br>**"AI SDRs don't work."** 11x staff reported losing 70% to 80% of customers. The counter: approval by default, the trigger in the first line, and call lists with a reason to call.<br>**Legality:**<br>- Use the official Places API and store only the `place_id`.<br>- Use government bulk data.<br>- Send no automated texts (Texas SB 140).<br>- Sell to businesses only, not homeowners.<br>**Permit lag.** Use a contractor's permit volume over time, plus faster signals: the Places "opening soon" status, Florida's daily business-filing files, liquor-license applications. |
| **Disqualify if** | **Wrong customer:** sells mainly to homeowners; enterprise-only targets; targets with no public-record footprint.<br>**No fit with the motion:** inbound-only or product-led growth with no outbound team; wants fully autonomous mass sending.<br>**Too big or covered:** large organizations that license or build their own local data (DoorDash bought DataLane).<br>**Weak economics:** deal size under about $1,500 a year; needs same-week triggers on fast jobs.<br>**Outside our data:** non-US. |

---

## Priority order

**A first.**
- **Cleanest pain:** owners publish the Bots' exact job description and already pay $400 to $1,500 a month for it.
- **Fastest close:** one decision-maker, month-to-month billing.
- **Existing tooling fits:** Kontract, the bid Bots and the demo were built for this segment.
- **Multiplier:** APEX centers and GovCon communities each reach thousands of these owners.

**Then B.**
- **For:** the same bid engine and data, at 4 to 10 times the price.
- **Against:** a crowded, well-funded field, a longer proof cycle and security gates. It needs SOC 2, Slack approvals, CRM sync and a per-workspace model policy first.

**Then C.**
- **For:** the pain and budget are real.
- **Against:**
  - It needs different data, including verified owner mobile numbers, which carry licensing cost.
  - It needs phone-first workflows.
  - It competes with funded data companies.
- **How:** partner with Shovels or DataLane for the data rather than build it.

## What this changes for the product

- **Pricing:** per business and month-to-month, near $149 a month for A, instead of $99 per seat.
- **Interface:** text first. The daily digest and approve-by-reply are the main interface, and the web app is the back office.
- **Bid features first:**
  - search across federal, state and county portals
  - solicitation reading with citations
  - SCA wage-determination pricing
  - subcontractor quote chasing
  - deadline tracking
  - AI-clause flags
- **Positioning check:** the current demo and test business is a "subcontracting prime". The evidence says that model also draws beginners and pass-through brokers, both disqualified above. Aim the story at firms that do the work themselves.

## Next steps

1. Collect 10 to 15 Reddit and Facebook quotes for Segment A by hand. Reddit was blocked here.
2. Build the lead-sourcing plan for Segment A from the triggers and watering holes above.
3. Design Offer 1 properly, then test it with 10 owners.
