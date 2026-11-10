# ICP evidence: technology companies selling to government (as of 2026-11-10)

Segment: GovTech startups selling to state and local government (SLED), defense tech, and small tech firms chasing SBIR/STTR, OTAs and federal IT contracts. Roughly 5 to 200 employees, with a small sales or BD team that is often founder-led.

Product being tested against this segment: an AI CRM whose Bots find opportunities (federal, state and local solicitations, SBIR topics, past awards), read RFPs, check compliance, price from past awards, draft responses and emails, and ask the seller to approve in Slack or by text.

## How to read these notes

Labels:
- **[V1]** Verbatim, copied by script from the raw source text (Hacker News API, govinfo.gov hearing transcripts). Highest confidence.
- **[V2]** Verbatim as quoted back by the page-fetch tool. Should be exact, but spot-check before putting it in a deck.
- **[P]** Paraphrase or summary. Not a quote.
- **[S]** Seen only in a search-engine result snippet. The page itself was not opened.
- **[VENDOR]** A vendor, competitor or investor making claims about its own market. Treat it as marketing.
- **[DERIVED]** Our own arithmetic on cited numbers.

Dates are publish dates where the source shows one. Otherwise "seen 2026-11-10" (the date fetched).

**Coverage gaps (be honest about these):**
- **Reddit could not be read.** reddit.com is blocked to this research agent's crawler, both in web search and in page fetch. No r/GovernmentContracting, r/govcon, r/sales, r/startups, r/defense or r/SBIR thread was read. The one Reddit-origin line below came from a search snippet of a mirror and is flagged as such. A human should pull 10–20 threads manually to close this gap.
- **LinkedIn posts** did not surface in search and cannot be fetched.
- **G2, Capterra, GetApp, TrustRadius, Gartner Peer Insights and Software Advice** returned 403. Reviews come from SoftwareFinder and SourceForge, which mirror verified reviews, plus search snippets.
- **The web-search budget for this run ran out** before Procurement Sciences pricing, NDIA event dates, and a few accelerator names (Techstars, NSIN, Embark, Hacking for Defense) could be checked. Those are marked "not verified".

---

## 0. Strongest findings (summary)

1. **Pain is real and specific.** Founders and small-business CEOs describe the work in the exact tasks the Bots automate:
   - "lost days deciding which federal opportunities to pursue and weeks assembling teams, researching competitors, pricing work, checking compliance... and writing proposals" (2x defense founder, Aug 2026).
   - "with a team of three people working in a garage, I did not have time to write a hundred-page proposal" (Vita Inclinata CEO, Senate testimony, Mar 2025).
   - The new-entrant barrier is "administrative burden and complexity of proposal submission" (PSI CEO, House testimony, Feb 2025).
2. **The segment already pays for fragments.** Small firms anchor on:
   - HigherGov: $500–$2,500/yr.
   - GovTribe: $1,200–$2,100 per seat per year.
   - GovSpend: Vendr median about $11.6K/yr.
   - GovWin IQ: Vendr average about $29K/yr, range $13K–$119K.
   - Consultants: $150–$300/hr, or SBIR advisors at $3K–$7.5K/month plus 3–7% of the award.
   - A capture manager hire: $140K–$200K base in 2026 startup postings.

   A Bot-based CRM priced between "data tool" and "first capture hire" has room.
3. **Detectable triggers are abundant and free.**
   - SBIR/STTR was reauthorized on 2026-04-13 through 2031 after a lapse that began 2025-10-01. Solicitations resumed in Apr–May 2026, and awards typically follow 3–9 months later, so a wave of new awardees runs through late 2026 and 2027.
   - AFWERX alone made >1,000 awards ($1.37B) in FY2025, and 45% of its 3,379-company portfolio is new to government.
   - CMMC Phase 2 (third-party certification in solicitations) starts **today, 2026-11-10**.
4. **The competitive field is crowded, funded, and consolidating.**
   - Funding: Starbridge ($52M), GovDash (~$40M), Procurement Sciences (~$40M, FedRAMP Moderate), Pursuit ($25.5M), NationGraph ($22.5M).
   - Exits: Vultron ($22M raised) handed its customers to pWin.ai in Apr 2026. Rogue AI was bought by Procurement Sciences in Feb 2026.
   - Most of them sell to proposal teams or enterprise public-sector sales teams. None of the fetched pages mention a Slack or SMS approval loop. Starbridge said in Oct 2025 that a Slackbot was a goal.
   - The open lane is the founder-led 5–50-person team that needs one system for find → qualify → draft → approve.
5. **The biggest objection for defense buyers is security and model provenance, not price.**
   - CUI/ITAR rules and CMMC are table stakes for proposal tools. Three competitors claim FedRAMP Moderate or an equivalent.
   - The Pentagon designated Anthropic a supply-chain risk in Mar 2026, and the D.C. Circuit upheld it 2–1 on 2026-09-25. Per The Next Web, the label "bars the military and its contractors from using Anthropic's Claude models".
   - Our Bot stack is multi-provider (`agentic-crm/openduet/openbot/shared/model-providers.json`: OpenAI default, Anthropic and Google optional). Defense tenants need a per-workspace "no Anthropic" model policy and a written model-lineage statement.
   - SLED GovTech and SBIR-only firms that handle no CUI are the faster beachhead.

---

## 1. Pain in the buyer's own words

At least 12 verbatim quotes were required. 24 are listed. Each line gives the speaker, the venue, the date and the URL.

### A. Finding opportunities across thousands of agencies, and noise

1. [V1] "While running my defense startup, I lost days deciding which federal opportunities to pursue and weeks assembling teams, researching competitors, pricing work, checking compliance, negotiating with subcontractors, and writing proposals."
   - 2x defense founder, Show HN: CaptureAgent, 2026-08-25. https://news.ycombinator.com/item?id=49442327
   - Note: the author now sells a competing tool.
2. [V1] "Pursuing poor-fit opportunities, or being disqualified over technicalities, consumed runway and pulled me away from engineering. The software, consultants, and proposal shops I engaged or worked with were expensive and still left much of the work to me."
   - Same post, 2026-08-25. https://news.ycombinator.com/item?id=49442327
3. [V2] "When I set up a very specific search, I still end up getting too many unrelated items emailed to me."
   - GovWin IQ reviewer, Enterprise 500+, Sep 2026. https://softwarefinder.com/sales-tools/govwin-iq
4. [V2] "The only downside is the sheer number of opportunities I have to sort through during my daily search."
   - GovWin IQ reviewer, Mid-Market 51–100, Jun 2026. https://softwarefinder.com/sales-tools/govwin-iq
5. [V2] "There's a lot of information packed into the platform so it can feel a bit overwhelming at times"
   - GovWin IQ reviewer, Small Business 11–50, Sep 2026. https://softwarefinder.com/sales-tools/govwin-iq
6. [V2] "Instead of bouncing between a bunch of bid sites"
   - GovSpend reviewer Kristi P., Small Business 11–50, Jul 2024 (older). https://softwarefinder.com/accounting-software/govspend/reviews
7. [V2] Investor describing customer pain: "Public sales teams tasked with hunting down these opportunities need to hop from site to site and manually log into portals that appear to have been last updated in the late 2000s"
   - Insight Partners on Govly, Nov 2023 (older). [VENDOR] [S] https://www.insightpartners.com/ideas/govtech-software-company-govly-announces-9-5-million-in-series-a-funding-to-fuel-product-development/
8. [V2] Starbridge CEO Justin Wenig: "Critical buying information is scattered across PDFs, agency websites, meeting minutes, and outdated directories."
   - TechCrunch, 2025-10-22. [VENDOR] https://techcrunch.com/2025/10/22/david-sacks-craft-leads-42-million-series-a-in-govtech-startup-starbridge

### B. Reading RFPs, compliance matrices, and proposal burden (incl. SBIR)

9. [V1] "The reality is, the SBIR program has continuously gotten longer and longer and longer in regards to its proposals. I can tell you with a team of three people working in a garage, I did not have time to write a hundred-page proposal. I have an elevator pitch."
   - Caleb Carr, CEO, Vita Inclinata Technologies (defense/rescue hardware, AFWERX open-topic SBIR → $50M Army IDIQ). Senate Small Business Committee hearing, 2025-03-05. https://www.govinfo.gov/content/pkg/CHRG-119shrg59474/html/CHRG-119shrg59474.htm
10. [V1] "Investors would turn us down, left, and right due to the lack of market knowledge on the issue and more importantly, the amount of complexity that designing a solution and selling said solution to the U.S. government would entail."
    - Caleb Carr, same hearing, 2025-03-05.
11. [V1] "The largest barrier to participation in the program for new entrants is increased administrative burden and complexity of proposal submission."
    - Bill Marinelli, President & CEO, Physical Sciences Inc. House Small Business Committee hearing, 2025-02-26. https://www.govinfo.gov/content/pkg/CHRG-119hhrg58905/html/CHRG-119hhrg58905.htm
12. [V1] "when we wrote our first proposal 20 years ago, it was a lot easier to write that first proposal. It was a lot easier to get started than it is now."
    - ML Mackey, CEO & co-founder, Beacon Interactive Systems. Same House hearing, 2025-02-26.
13. [V1] "I'm considering applying to a phase I topic that is a pretty good fit for our tech... but I'm unsure if the juice is worth the squeeze."
    - Ask HN poster (small tech company), 2026-06-18. https://news.ycombinator.com/item?id=48579256
14. [V1] "It's a ton of paperwork and bureaucracy --probably even more so under current administration-- but still a great alternative/addition to VC"
    - HN commenter on SBIR, 2025-04-07. https://news.ycombinator.com/item?id=43613593
15. [V1] Former evaluator, now investor: "you get so many proposals that you try to take the easy way out, and you say, who didn't cross their t and dot their i perfectly. And so that sort of sentiment certainly favors those who have gone through the process before"
    - David Rothzeid, Shield Capital. Senate hearing, 2025-03-05. https://www.govinfo.gov/content/pkg/CHRG-119shrg59474/html/CHRG-119shrg59474.htm
16. [V1] Reviewer-side view: "Most proposals are pretty mediocre. Some are physically impossible... You'd be surprised how many companies don't actually make any clear objective case with facts and figures..."
    - NASA civil servant who reviews SBIRs, 2026-06-18. https://news.ycombinator.com/item?id=48581048
17. [V2] What startups put in proposal-manager job ads: "Build and maintain a proposal asset library of reusable, high-quality templates including cover letters, SOWs, compliance matrices" and "Ensure compliant submissions across government portals (SAM.gov, agency-specific systems)"
    - Scout AI (11–50 employees) Proposal Manager, $160K–$190K. Posting closed; seen 2026-11-10, posted about 3 weeks earlier. https://jobright.ai/jobs/info/6a5435cc8576ec69c015265d
18. [V2] "including win themes, compliance matrices, wall walks, and color team reviews" and "through the Shipley process across SBIR, OTA, and traditional FAR-based solicitations"
    - Red 6 (early-stage defense) Capture Manager, $160K–$200K. Job removed 2026-10-14. https://www.builtinnyc.com/job/capture-manager/11474027

### C. Long sales cycles, cash flow, and "who is the customer"

19. [V1] "For follow-on work you need to find government customers and project champions. The SBIR program isn't your customer, it's funding. There are a lot of SBIR advisors out there, and some of them are predatory."
    - HN commenter, 2026-06-18. https://news.ycombinator.com/item?id=48579385
20. [V1] "Whenever there is a delay in awarding a contract, small businesses fail. They simply don't have the cash flow to carry them over to the next one."
    - Jere Glover, Small Business Technology Council. House hearing, 2025-02-26. https://www.govinfo.gov/content/pkg/CHRG-119hhrg58905/html/CHRG-119hhrg58905.htm
21. [V1] "Startups are always problematic for government procurement, and unless you play in a space that is setup to handle small vendors, your business is going through partners anyway."
    - HN commenter, FedRAMP 20x thread, 2025-05-13. https://news.ycombinator.com/item?id=43969189
22. [V1] "Even companies that primarily sell software to the US Government don't get software like margins. Functionally, the business of selling software to the US Government scales like plumbing..."
    - HN commenter, "The Defense-Tech Bubble Is Headed for Consolidation", 2026-08-20. https://news.ycombinator.com/item?id=49378371
23. [V1] "The overhead of selling to the government is significantly higher than selling to private companies."
    - HN commenter, 2025-12-05. https://news.ycombinator.com/item?id=46168979
24. [V1] "They got the highest possible rating upon completion, but have not been able to apply for Phase 2, so the project is effectively dead..."
    - HN commenter helping a Phase I SBIR team through the 2025 disruption, 2026-04-26. https://news.ycombinator.com/item?id=47906090

### D. Tools: CRM fit and the cost of data tools

25. [V2] "it felt pricey and did not deliver any leads I was not already getting from other paid bid platforms."
    - GovSpend reviewer Robert K., Mid-Market 500+, Aug 2023 (older). https://softwarefinder.com/accounting-software/govspend/reviews
26. [V2] "Unfortunately it has not helped us land a single meeting."
    - GovSpend reviewer, Translation & Localization, 11–50, Dec 2024. https://softwarefinder.com/accounting-software/govspend/reviews
27. [V2] CRM appears as a must-have even in founding roles:
    - "Demonstrated experience setting up and operating Customer Relationship Management (CRM) systems" and "building CRM sequences, collecting and cleaning contacts"
    - Emerge Career (8 employees), Founding Govt Account Executive, $150K–$200K OTE. Reposted about Aug 2026. https://builtin.com/job/founding-govt-account-executive/9167732
    - Same pattern: Red 6 "Maintain pipeline and capture data in CRM"; Scout AI "CRM and pipeline tool proficiency for deal tracking, reporting, and workflow management".
28. [S] Reddit-origin line, unverified. It appeared in a search snippet of a Reddit mirror page for r/GovernmentContracting, dated around Mar 2025:
    - "Market Intel tools 2025 ... Bgov is astronomically priced and I can't imagine govwin being alot better (in terms of price)."
    - Do not cite externally until checked on reddit.com.

**Paraphrased pain (not quotes):**
- [P] Esper CEO Maleka Momand, on GTMnow as summarized by OnTargetIsh (2026-06-05): three-year govtech sales cycles are standard, and "governments look for reasons not to trust new vendors" (article wording, not hers). https://ontargetish.pages.dev/news/esper-ceo-why-govtech-sales-takes-three-years-and-professional-services-are-a-moat
- [P][S] Atlas Space Operations founder (Frontlines podcast): if you sell to government, multiply your revenue timeline by four. The page returned 429 and was not opened. https://www.frontlines.io/?p=11417
- [P] Senate SBIR hearing (2025-03-05): Chair Ernst's INNOVATE Act pitch was a "simplified two-page proposal process ... so that more innovators ... can have access to this program, even if they can't hire professional grant writers." This is [V1] for the senator, but she is not a buyer.

---

## 2. Trigger events, and where each is observable

| # | Trigger | Why it creates demand | Where to detect it (data source) | Evidence and timing |
|---|---|---|---|---|
| T1 | **New SBIR/STTR Phase I or Direct-to-Phase II award** | First government revenue. The firm now needs Phase II positioning, a transition customer and a Phase III path ("The SBIR program isn't your customer, it's funding", HN 2026-06-18). | SBIR.gov award search; USAspending.gov / FPDS award records. FPDS "Research" field codes SR1/SR2/SR3 (SBIR) and ST1/ST2/ST3 (STTR) identify phases [knowledge, verify]. DoD DSIP topic portal. AFWERX/SpaceWERX announcements. Note: the SBIR.gov public awards API returned 403 to our test call on 2026-11-10, so plan on bulk downloads or USAspending. | AFWERX: "Most awards are issued within three to nine months." FY2025: >1,000 contracts, $1.37B. 3,379-company portfolio since 2019, **45% new to government** (DVIDS, 2026-04-29). https://www.dvidshub.net/news/printable/564491 |
| T2 | **SBIR reauthorization wave** | The programs lapsed 2025-10-01. S.3971 was signed 2026-04-13 and runs through 2031-09-30. Solicitations restarted in Apr–May 2026, so pent-up topics and awards land in FY2026–FY2027. A new post-Phase II "Strategic Breakthrough" category was added (reported up to $30M). | Agency solicitation calendars. AFWERX says FY27 Release 1 is open and FY27 Release 2 (27.BZ SBIR / 27.TZ STTR) is in pre-release, when startups may contact topic authors. | UW Federal Relations, 2026-04-14: https://www.washington.edu/federalrelations/2026/04/14/trump-signs-sbir-sttr-reauthorization-bill-into-law/ ; IEDC, 2026-04-15: https://www.iedconline.org/news/2026/04/15/federal-policy-updates/federal-policy-update-sbir-and-sttr-reauthorized/ ; AFWERX site, seen 2026-11-10: https://afwerx.com/ |
| T3 | **Raising a round with a public-sector or defense thesis** | Money to hire BD; investors push for government revenue. | Press releases; Crunchbase/PitchBook; SEC EDGAR Form D filings (free); investor portfolio pages (Shield Capital, Craft, Lux, Menlo, Govtech Fund, YC); defense-tech VC lists. | Defense tech VC hit a record $49.1B in 2025, up from $27.2B in 2024 (PitchBook via Defense News, 2026-01-20), and $19.8B in Q1 2026 alone (search summary of PitchBook Q1 2026). https://www.defensenews.com/industry/2026/01/20/defense-tech-startups-had-their-best-funding-year-ever-in-2025/ |
| T4 | **Hiring a first public-sector AE, capture manager or proposal manager** | The company has decided to build a government motion, but it has no process or CRM yet ("creates and implements our public-sector sales initiatives from scratch"). | Greenhouse, Lever and Ashby boards; LinkedIn Jobs; Built In; ClearanceJobs; VC portfolio job boards (e.g. jobs.luxcapital.com). | 2026 examples: Emerge Career (8 people) founding govt AE, $150K–$200K OTE; Scout AI (11–50) proposal manager, $160K–$190K; Red 6 capture manager, $160K–$200K; Applied Intuition capture/proposal, $165K–$200K + equity; Chaos Industries capture (S&T), $140K–$180K (posted 2026-06-29, [S]). URLs in §1 and §4. |
| T5 | **New GSA MAS award or state cooperative contract** | A vehicle lets agencies buy without a full RFP, so the firm needs to market the vehicle and work leads fast. | GSA eLibrary (schedule holders); FPDS/USAspending. Cooperative contract award lists: NASPO ValuePoint, Sourcewell, OMNIA Partners, TIPS, Texas DIR, CMAS [names from knowledge; not fetched]. | Agencies can "piggyback" another agency's competitively awarded contract and skip the RFP (Starbridge blog [VENDOR][S]). Cooperative contracts like Sourcewell and NASPO let agencies buy without a formal RFP (Tyler Technologies blog [S]). https://starbridge.ai/blog/spot-government-rfp-written-for-another-vendor |
| T6 | **FedRAMP or GovRAMP (formerly StateRAMP) authorization, or "In Process" status** | Huge sunk cost (estimates below). The firm must now monetize it with more pipeline. | FedRAMP Marketplace (marketplace.fedramp.gov); GovRAMP Program Participants List (330+ products per secondary source; renamed from StateRAMP on 2025-02-14; legal entity is still StateRAMP). | HN: FedRAMP cost "probably pretty accurate" at $1M for a ~50-person startup, and "It definitely paid for itself in the number of contracts it unlocked" [V1, 2025-05-13] https://news.ycombinator.com/item?id=43969569 . GovRAMP rename: https://knoxsystems.com/resources/govramp [S] |
| T7 | **CMMC milestone** | Phase 1 (self-assessment in DoD solicitations) began 2025-11-10. **Phase 2 (C3PAO certification in applicable solicitations) begins 2026-11-10.** Phase 3 starts 2027-11-10. Firms that just certified want to bid; firms that can't are pushed to subcontract. | DFARS 252.204-7021 in solicitation text (parse RFPs); SPRS (not public); company press releases. | Schwabe: https://www.schwabe.com/publication/dod-issues-final-rule-implementing-cmmc-requirements-in-dfars/ ; Venable (2025-11): https://www.venable.com/insights/publications/2025/11/theyre-here-the-cybersecurity-maturity-model . One source says DoD paused the transition on 2026-07-13 for a 60-day CMMC reform review. Single source, unverified [S]. |
| T8 | **Federal budget cycle and Q4 surge** | Federal FY starts Oct 1. Q4 (Jul–Sep) carries roughly 30% of annual contract obligations. Sep 2025 alone topped $152B, about one-fifth of the year (BGOV). FY2025 obligations were $834B vs $776B in FY2024 (GovWin). | USAspending monthly obligations; agency forecast pages; SAM.gov sources-sought and RFI notices; DoD budget request (Feb). | [S] Bloomberg Government: https://news.bgov.com/bloomberg-government-news/federal-procurement-rises-ahead-of-fiscal-year-closeout-rush ; GovWin analysis: https://iq.govwin.com/neo/marketAnalysis/view/8791 |
| T9 | **State and local budget adoption** | 46 states start the fiscal year on July 1 (NY Apr 1, TX Sep 1, AL and MI Oct 1). Local budgets are adopted in council meetings, which signal projects 6–18 months before an RFP. | State budget documents; council and board meeting minutes and budget PDFs (what Starbridge, NationGraph and Civic IQ index); pre-solicitation notices on state portals. | NCSL FY2026 status: https://www.ncsl.org/fiscal/fy-2026-state-budget-status [S]. Civic IQ claims signals arrive 6–18 months before procurement [VENDOR][S]. |
| T10 | **Contract expiration or recompete for an incumbent the startup can displace** | A known date to start capture 12–18 months out. | USAspending period-of-performance end dates; FPDS; SLED purchase orders (Starbridge claims PO data for 77% of SLED institutions [VENDOR]). | Starbridge landing page, seen 2026-11-10: https://starbridge.ai/lp/ai-gtm-platform-govtech |
| T11 | **Accelerator or cohort selection, or an AFWERX Pitch Day** | The firm is being pushed toward a government customer and gets an SBIR/OTA path. | Cohort press releases (Griffiss Institute HUSTLE/AFRL; Catalyst Accelerator/Space Force; Montgomery TechLab; CRP DefenseTech Huntsville; SDA TAP Lab; NATO DIANA). | HUSTLE Cohort 5 (5 startups, Mar 2026): https://www.griffissinstitute.org/wp-content/uploads/2026/02/02232026-Press-Release-Five-U.S.-Startups-Selected-to-Advance-Air-Force-Command-and-Control-Through-Griffiss-Institutes-HUSTLE-Defense-Accelerator.pdf ; NATO DIANA picked 150 of 3,680 for 2026 [S]: https://www.diana.nato.int/connect/nato-diana-announces-largestever-cohort-150-innovators-selected-across-ten-challenge-areas-for-2026-challenge-programme.html |
| T12 | **First SAM.gov registration, or renewal** | The firm is about to bid for the first time. | SAM.gov entity data (public extracts). | A Show HN tool (Firmenza, 2026-10-16) is built on registration-expiry reminders, which shows the signal is in use. https://news.ycombinator.com/item?id=50124216 |

---

## 3. Watering holes

Dates are event dates. Lists are as published by the cited source.

### Defense / federal events
- AUSA Annual Meeting: 2026-10-12–14 (DC), 2027-10-11–13.
- AFA Air, Space & Cyber: 2026-09-14–16 (National Harbor).
- I/ITSEC: 2026-11-30 to 12-04 (Orlando).
- AFCEA TechNet Cyber: 2027-05-11–13 (Baltimore).
- AFCEA TechNet Augusta: 2027-08-17–19.
- Prodacity: 2026-08-25–27 (Nashville).
- GovCIO AI Summit: 2026-11-06.
- Source for all of the above: Pursuit's list of 50 conferences, published 2026-10-26 [VENDOR]. https://www.pursuit.us/blog/government-technology-conferences
- Defense Tech Conference (SF, 2026-11-04, founder pitch session). https://luma.com/defensetechwest
- Dual Tech Summit (SF, 2026-06-24) [S].
- Tough Tech Dual-Use Day (Boston) [S].
- NDIA events: the page did not load; dates not verified. https://www.ndia.org/events
- Reagan National Defense Forum, Hill & Valley Forum, SOF Week, Modern Day Marine: not verified this run.

### SLED / GovTech events
- Code for America Summit: 2026-05-07–08 (Chicago); next 2027-06-03–04 (DC). https://summit.codeforamerica.org/ [S]
- NASCIO Annual: 2026-09-27–30 (San Diego) and 2027-10-03–06 (Indianapolis). NASCIO Midyear: 2027-05-09–12.
- GovAI Coalition Summit: 2026-12-09–11 (San Jose; $200 registration [S]). https://events.govtech.com/GovAI-Coalition-Summit
- NLC City Summit: 2026-11-19–21 (Nashville).
- GFOA: 2027-06-06–09 (New Orleans).
- GovRAMP Cyber Summit: 2026-11-15–17 (San Antonio).
- Envision SLG IT Summit: 2026-12-02–03.
- OpenGov Conference: 2027-05-17–20 (DC).
- Tech in Gov America: 2027-09-01–02.
- Education: EDUCAUSE, CoSN, FETC.
- Source for the list above: Pursuit list, 2026-10-26.
- NASPO Exchange: 2026-03-09–12 [S].

### SBIR / defense accelerators and programs
- **AFWERX** (SBIR/STTR open topics; FY27 Release 1 open; Release 2 pre-release). https://afwerx.com/
- **SpaceWERX**.
- Griffiss Institute **HUSTLE** (AFRL).
- **Catalyst Accelerator** (Space Force SSDP, 15th cohort) [S].
- **Montgomery TechLab**.
- **CRP DefenseTech Accelerator** (Huntsville; 3rd cohort announced 2026-04-10) [S].
- **SDA TAP Lab** (Cohort 4 started 2026-02-17) [S].
- **NATO DIANA**.
- Not verified this run: Techstars, NSIN, Embark, Hacking for Defense.

### GovTech investors and programs
- **Govtech Fund**: site returned 503; CB Insights lists 43 investments [S].
- **CivStart**: now a government-facing platform. It publishes "State of GovTech 2026" and ran the "State of GovTech 2025" startup pitch event on 2025-06-17–18 in Arlington. https://www.civstart.com/
- **Y Combinator**: Sweetspot S23, GovDash YC-backed.
- **Craft Ventures**: Starbridge, Vultron.
- **Menlo Ventures**: NationGraph.
- **Shield Capital**: Mission Matters podcast. Its principal testified to the Senate.

### Podcasts and newsletters
- **The Merge** (newsletter + podcast; Dec 2025 episode with Pryzm).
- **Mission Matters** (Shield Capital; episodes through Sep 2026).
- **The Defense Tech Underground**.
- **The Startup Defense**.
- **Defense Tech Builders**.
- **The Drone Ultimatum**.
- **Cogs of War** (War on the Rocks).
- All of the above are podcast-directory entries [S].
- GovCon side: **GovCon Giants Podcast** (Eric Coffie; Mar 2026 episode), **Government Contracting Officer Podcast** (Jun 2026 episode), **PilieroMazza GovCon Live!**, **GovConJudicata**. https://news.clearancejobs.com/2025/01/20/10-best-government-contracting-podcasts [S]
- News: Federal News Network, Washington Technology, Bloomberg Government, GovConWire/ExecutiveBiz, Defense News, GovTech.com, Route Fifty.

### Online communities
- **Hacker News** "Ask HN" SBIR threads (2026-06-18) and Show HN launches of govcon tools: CaptureAgent (2026-08-25), Firmenza (2026-10-16), ScotiaSignal (2026-01-07).
- **r/GovernmentContracting** exists (seen in a mirror listing) but could not be read.
- One HN commenter (2025-01-19) names "LinkedIn, ClearanceJobs, and GovConNet" as the high-trust networks for this market [V1]. https://news.ycombinator.com/item?id=42758319
- APMP, NCMA and APEX Accelerators: known professional channels, not verified this run.

---

## 4. Budget behavior: what they already pay, and what reviews say

### Market-intelligence and bid-finding tools

| Tool | Price evidence | Date / source | What users like or hate |
|---|---|---|---|
| **Deltek GovWin IQ** | Vendr: average contract $29,313 over 12 deals; min $13,000, max $119,000 [S]. Third-party estimate $12K–$42K/yr [S]. Plans: Federal Essentials/Professional/Advanced; State/Local Essentials/Market Intelligence/Professional; custom quotes. | Vendr buyer guide (page 404 on fetch; numbers from search snippet): https://www.vendr.com/buyer-guides/govwin-iq ; plan names: https://softwarefinder.com/sales-tools/govwin-iq (seen 2026-11-10) | Likes: "The match percentage they provide is something I really appreciate." (Sep 2026); "One site where I can find most federal opportunities is a big plus." (Jun 2026). Hates: alert noise and volume (quotes 3–5 in §1). Older reviews [S] say SLED data was "incomplete or not useful" and "old". |
| **GovSpend** | Vendr: average = median **$11,576**; min $7,900; max $49,470; 37 purchases. | Vendr, "Last updated: February 2026". https://www.vendr.com/buyer-guides/gov-spend | Likes: "Being able to search across all RFPs and pull up exactly what I need is a game changer." (Jun 2024); "Having access to so much info specific to my sales region is huge." Hates: price vs. lead uniqueness (Aug 2023), no meetings (Dec 2024), "the number of leads has not been quite as high as it used to be" (May 2024). https://softwarefinder.com/accounting-software/govspend/reviews |
| **HigherGov** | Starter **$500/yr** (1 user); Standard **$2,500/yr** (up to 10 users); Enterprise custom. All plans include federal + SLED opportunities, pursuit management, AI tools, API, Zapier and a Labor Pricing Tool. | Pricing page, seen 2026-11-10 (undated). https://www.highergov.com/pricing/ | No G2 reviews ("This product hasn't been reviewed yet!") [S]. It is the budget anchor for small firms. |
| **GovTribe** (owned by GovExec) | GovTribe: $1,900/seat/yr at 1 seat, falling to $1,200 at 6+. Pro: $2,100 → $1,400 (adds eBuy and contract-vehicle opportunities). AI credits at 9¢ each. 7-day trial. | Pricing page, seen 2026-11-10. https://govtribe.com/pricing | Commonly recommended as the cheaper GovWin alternative [VENDOR comparison sites][S]. |
| **Govly** | Free tier (public solicitations from the past 30 days); paid plans "Get pricing". Directory listings claim from about $15,000/yr [S, unverified]. | Pricing page © 2026. https://www.govly.com/pricing | n/a |
| **Bloomberg Government** | Launched at $5,700/yr (2010). A competitor estimates about $7,500/seat/yr [S, unverified]. | https://sunlightfoundation.com/2010/10/16/the-price-of-access/ [S] | "astronomically priced" (Reddit-mirror snippet, see §1 #28, unverified). |
| **Periscope S2G** (SLED bids) | $109/mo (one state), $131/mo (regional), $274/mo (national) per Capterra listing [S]. BidNet Direct sources need a separate subscription (one review [S]). | https://www.capterra.com/p/166830/Periscope-S2G/pricing/ [S] | n/a |
| **BidPrime** | $4,600–$9,500/yr. | Gov Contract Finder pricing guide, sources checked 2026-07-20 [VENDOR]. https://govcontractfinder.com/tools/government-contracting-software-pricing-guide | n/a |
| **Starbridge** | Not public. Annual subscription "based on GTM team size and the workflows" [S, G2]. A competitor calls it premium-priced with no free tier [VENDOR][S]. | https://www.g2.com/products/starbridge/pricing [S] | Customer stats [VENDOR]: Zencity sources 50% of its cold meetings from it; ClearGov reports $16.4M new pipeline and 163%+ ROI; GovWell gets 15% of qualified pipeline. |

### AI proposal and capture tools

| Tool | Price evidence | Source |
|---|---|---|
| **GovDash** | "Talk to sales for seat prices and credit allotments". Starter is 1 full seat (annual); Growth is 8+ seats; unlimited flex seats. | https://www.govdash.com/pricing (seen 2026-11-10) |
| **Sweetspot** | Demo only. | https://www.sweetspot.so/pricing |
| **Vultron / pWin.ai / Procurement Sciences** | Not found. The search budget ran out before Procurement Sciences was checked. | — |

### General CRMs they already run
- **Salesforce Sales Cloud** (per user per month, annual): Starter $25, Pro Suite $100, Core $195, Advanced $395, Max $550. Agentforce for Sales starts at $125 per user per month. https://www.salesforce.com/sales/pricing/ (seen 2026-11-10)
- **HubSpot Sales Hub** (per seat per month, annual):
  - Starter $7 ($20 billed monthly).
  - Professional $90, plus a $1,500 onboarding fee.
  - Enterprise $150, plus a $3,500 onboarding fee.
  - https://www.hubspot.com/pricing/sales (seen 2026-11-10)

### Proposal consultants (per SBIR or per proposal)
- [V1] "Independent capture and proposal consultants can charge roughly $150–$300 an hour. SBIR advisory firms typically charge $3,000–$7,500 monthly plus 3-7% of an award ($7,500–$17,500 on a $250,000 win)."
  - Defense founder, 2026-08-25. https://news.ycombinator.com/item?id=49442327
- BWCO Consulting [VENDOR][S]: Phase I flat fee $13,000, or $10,000 upfront plus a 5% success fee. Review-only package: $2,000. https://www.bwcoconsulting.com/new-blog
- 2026 rate guide [S]: $5,000–$20,000 per Phase I proposal. https://www.jobbers.io/?p=91833
- Caveat [S, vendor claims]: success fees paid from SBIR award funds may be unallowable (FAR Part 31). Verify before relying on it.
- Consultant spend counts toward Phase I outsourcing caps of about 33% [S]. https://sbir.org/getting-started/sbir-sttr-subcontracting-consultant-limits
- State subsidies [S]: Maine MTI pays up to $5,000 per proposal; Hawaii HTDC up to $3,000 per Phase I.
- EU comparison [V1]: "I hired an agency. They took 8% fee, which is pretty low, usually it's between 10% and 15%." (2026-06-18) https://news.ycombinator.com/item?id=48583207

### People cost (the "first hire" alternative)
- Capture manager:
  - Payscale 2026 average $137,294 (10th–90th percentile $89K–$204K) [S].
  - Salary.com $138,891 (May 2026) [S].
  - GovCon Giants: mid/senior $150K–$220K base [VENDOR][S].
- Startup capture/proposal postings in 2026: $140K–$200K base.
  - Chaos Industries $140K–$180K [S].
  - Applied Intuition $165K–$200K + equity (https://jobs.luxcapital.com/companies/applied-compute-2/jobs/70585725-capture-manager-defense).
  - Red 6 $160K–$200K.
  - Firestorm Labs $140K–$193K [S].
  - Scout AI proposal manager $160K–$190K.
- Proposal writer: Indeed average $78,006; ZipRecruiter $81,248 (Jun 2026) [S].

### Compliance cost they may face
- FedRAMP:
  - About $1M at a ~50-person startup [V1, 2025-05-13].
  - Another commenter [V1, 2026-03-18, https://news.ycombinator.com/item?id=47431562]: "$2-3M minimum" and 2–3 years if done alone, or a "sticker price of 200-500k/y" to deploy in a third-party FedRAMP enclave.
  - That account was disputed [V1, 2026-03-19, https://news.ycombinator.com/item?id=47435119]: "Having been through FedRAMP twice, I can this is absolute fiction."

### [DERIVED] Implication for price
- A 10-person founder-led firm that buys HigherGov Standard ($2.5K), GovTribe Pro for 2 seats (~$3.6K), HubSpot Pro for 3 seats (~$3.2K + $1.5K) and one Phase I consultant engagement (~$13K) spends about **$20–25K a year** before any capture hire.
- A capture manager costs **$140–200K a year**.
- A Bot CRM at **$6K–$24K a year** ($500–$2,000 a month) sits between the data-tool tier and the human tier. It must beat HigherGov's $500 floor on outcomes, not data.

---

## 5. Objections to adopting an AI tool here, with counters

1. **"Our proposal content is CUI / ITAR / export-controlled; we can't paste it into AI."**
   - Evidence:
     - Vendor guides say public AI tools are "not appropriate for CUI, ITAR/EAR data" [VENDOR][S]: https://goveagle.com/blog/secure-ai-platforms-government-proposal-data
     - Under 32 CFR Part 170, cloud providers handling CUI need FedRAMP Moderate or an equivalent [S].
     - CMMC Phase 2 starts 2026-11-10.
     - Competitors already claim this bar:
       - Procurement Sciences: FedRAMP Moderate Authorization, press release 2026-03-13 [S]. https://digital-release.wowktv.com/business/press-releases/cision/20260313PH09946/procurement-sciences-achieves-fedramp-moderate-authorization
       - GovDash: "FedRAMP Moderate Equivalency", Azure Government single-tenant, "validated for CUI and CDI". https://www.govdash.com/security
       - Sweetspot: claims "FedRAMP Moderate Authorized, CMMC Level 2, SOC 2 Type II". https://www.sweetspot.so/
       - pWin.ai: "FedRAMP Moderate Equivalency".
   - **Counter:**
     - (a) Scope v1 to public data (solicitations, SBIR topics, awards, budgets) and non-controlled drafts. Keep technical volumes containing CUI in the customer's GCC-High or Azure Gov tenant.
     - (b) Publish a data-boundary statement: no training on customer data, tenant isolation, retention controls.
     - (c) Lead with SLED GovTech and SBIR-only firms, where CUI is rare.
     - (d) Put FedRAMP Moderate equivalency or GovRAMP on the roadmap before courting CUI-heavy defense primes' subs.
   - Honest assessment: for CUI-heavy defense buyers this objection currently wins.
2. **"We can't use that model."**
   - Evidence:
     - The Pentagon labelled Anthropic a supply-chain risk in March 2026. The D.C. Circuit upheld it 2–1 on 2026-09-25. Per The Next Web, "The label bars the military and its contractors from using Anthropic's Claude models." https://thenextweb.com/news/anthropic-pentagon-supply-chain-risk-appeals-court-ruling
     - A separate N.D. Cal. ruling (Apr 2026) lets non-Pentagon agencies keep using Claude (PBS/AP, 2026-04-09). https://www.pbs.org/newshour/politics/appeals-court-decides-against-anthropic-in-latest-round-of-its-ai-battle-with-the-trump-administration
     - [V1]: "all deepseek or qwen models are de facto prohibited in govcon, including local machine deployments via Ollama or similar... contracts are already including language for prohibition not just in the product but any part of the software environment." (2026-04-16) https://news.ycombinator.com/item?id=47794612
   - **Counter:**
     - Our Bots already run multi-provider (`agentic-crm/openduet/openbot/shared/model-providers.json`: OpenAI default, Anthropic and Google optional).
     - Ship a per-workspace model allowlist ("no Anthropic / no PRC-origin models"), a model-lineage page, and an option to run on Azure OpenAI or another government-cloud endpoint.
     - Make this a sales asset for defense tenants, not a footnote.
3. **"AI will hallucinate and get us disqualified."**
   - Evidence: evaluators screen on "who didn't cross their t and dot their i perfectly" (Rothzeid, 2025-03-05). The founder above lost runway to being "disqualified over technicalities".
   - **Counter:**
     - Compliance matrix with clause-level citations to Sections L/M/C.
     - Page-limit and format checks.
     - Every outbound draft gated by human approval in Slack or SMS.
     - Show a red-team diff, not a black box.
4. **"We already have Salesforce/HubSpot (or GovWin)."**
   - Evidence: job posts require operating a CRM (Red 6, Scout AI, Emerge Career). Competitors integrate rather than replace:
     - Starbridge: bi-directional Salesforce/HubSpot sync.
     - GovDash: syncs stages to Salesforce.
     - Sweetspot: Salesforce integration.
   - **Counter:**
     - Offer two-way sync and position the Bots as the work layer.
     - For founder-led teams with no CRM admin, being the CRM is cheaper than Salesforce Core at $195/user/mo plus Agentforce at $125/user/mo.
     - Feed existing GovWin or HigherGov alerts in as one source, then triage the noise users complain about.
5. **"Government sales is relationships; software won't help."**
   - Evidence [V1]:
     - "SBIR / STTR is all about networking and influence." (2026-03-03) https://news.ycombinator.com/item?id=47237946
     - Advice from an SBIR veteran: "As soon as you know you're interested in a topic, send an email to the Principal Investigator" (2026-06-18). https://news.ycombinator.com/item?id=48580474
   - **Counter:**
     - The Bots do exactly that relationship prep: find the topic author or TPOC during pre-release, draft the outreach, and log the call.
     - Pitch it as more champion conversations, not fewer.
6. **"Vendors in this space keep disappearing."**
   - Evidence:
     - Vultron's customers were moved to pWin.ai on 2026-04-29 ("effectively ends the operational run of Vultron.ai's own proposal platform"). https://briefglance.com/articles/govcon-ai-shake-up-pwinai-acquires-vultronais-customer-portfolio
     - Rogue AI was acquired on 2026-02-18. https://orangeslices.ai/procurement-sciences-acquires-rogue-ai-to-accelerate-end-to-end-ai-growth-platform-for-government-contracting/
     - An HN thread (2026-08-20) is titled "The Defense-Tech Bubble Is Headed for Consolidation".
   - **Counter:** open data model (Twenty-based CRM), full export, month-to-month for small teams.
7. **"We were burned by SBIR advisors."**
   - Evidence [V1]: "some of them are predatory" (2026-06-18).
   - **Counter:** transparent pricing, a trial on a live topic, no success fees.

---

## 6. Disqualifiers

- **Too small, or not ready:**
  - No SAM.gov registration or UEI, no product, or a single one-off SBIR attempt.
  - A budget below HigherGov's $500/yr anchor.
  - Teams that rely only on free state or SBDC help. Iowa's SBDC testified it already brought on "a myriad of different proposal development tools" for clients (2025-03-05).
- **Too big:**
  - Primes and mid-tiers with a capture shop, a Shipley process, Salesforce Government Cloud and GovWin. Comparison guides say Salesforce "dominates at larger primes and mid-tier contractors" [S].
  - Firms over 500 employees can't use SBIR (AFWERX eligibility [P]: U.S.-owned small businesses with 500 or fewer employees), so half the value disappears.
- **"SBIR mills":** high-volume repeat awardees with in-house writers. They have the least pain and are the target of proposal caps and reforms (Ernst's INNOVATE Act; Carr: "should not be a welfare program to award 50 plus contracts to the same party").
- **Classified-only work:**
  - Opportunities are not public, and data cannot leave classified networks.
  - Likewise CUI-heavy proposal work that requires a FedRAMP-authorized boundary we don't yet have.
- **Contract rules that forbid our model mix:** a DoD prime flows down "no Claude" or another model ban we can't meet in that workspace. This is solvable by config; it disqualifies only if they require a FedRAMP-authorized SaaS.
- **Services / staff-augmentation contractors:** 8(a) IT services, body shops. That market scales "like plumbing" (HN 2026-08-20) and is a different ICP. This one is product companies.
- **Sells only through resellers or primes** ("your business is going through partners anyway", HN 2025-05-13). Less need for opportunity-finding, though partner tracking may still sell.
- **Non-US-owned firms.** SBIR now adds foreign-risk screening. Reauthorization requires agencies to assess security risk before an award.
- **SLED vendors whose purchases are small or co-op only.** Below formal-bid thresholds, or bought through Sourcewell, NASPO or piggybacking, so there is little RFP work.

---

## 7. Market size facts

### SBIR/STTR (official)
- **FY2024:** 11 agencies issued **$4.35B** across **6,444 awards**.
  - Open topics: 3,048 awards (47%).
  - **DoD:** 3,422 awards and $2.73B (about 53% of awards and 63% of dollars).
  - First-time awardees, FY2024: DoD 34% (open) / 10% (conventional); NSF 66% (open).
  - Source: GAO-26-108750, 2026-09-29. https://files.gao.gov/reports/GAO-26-108750/index.html
- [DERIVED] GAO reports 1.3 open-topic and 1.9 conventional awards per unique business. That implies roughly **3,000–4,100 unique awardee firms a year**. Overlap between the two groups is unknown.
- **DoD SBIR applicant pool, FY2019–FY2023:**
  - **11,609 unique firms** applied.
  - 45,550 Phase I applications produced 8,093 Phase I awards (17.8%).
  - The Phase I funding rate fell from 20.5% (FY2019) to **12.1% (FY2023: 1,007 of 8,338)**.
  - So most applicants lose, which drives demand for a cheaper, faster proposal per shot.
  - Source: National Academies, *Review of the SBIR and STTR Programs at the Department of Defense* (2026), ch. 5. https://www.nationalacademies.org/read/29329/chapter/7
- **AFWERX/SpaceWERX:**
  - 3,379 portfolio companies since 2019; 45% new to government.
  - FY2025: >1,000 contracts worth $1.37B, and 438 Phase III transitions worth $8.1B.
  - Source: DVIDS release dated 2026-04-29. https://www.dvidshub.net/news/printable/564491
- **Reauthorization:** S.3971 signed 2026-04-13, runs through 2031-09-30. The lapse began 2025-10-01. Senate voice vote 2026-03-03; House 345–41 on 2026-03-17 [S]. https://www.washington.edu/federalrelations/2026/04/14/trump-signs-sbir-sttr-reauthorization-bill-into-law/

### Defense tech funding
- **2025:** record **$49.1B** of VC deal value (PitchBook), up from $27.2B in 2024. Exits reached $54.4B. https://www.defensenews.com/industry/2026/01/20/defense-tech-startups-had-their-best-funding-year-ever-in-2025/ (2026-01-20)
- Narrower definitions: CB Insights $17.9B (2025) and Crunchbase $7.7B through Oct 2025 [S].
- **Q1 2026:** $19.8B, a record quarter (PitchBook) [S].

### Federal contracting
- FY2025 total contract obligations: **$834B**, vs $776B in FY2024 (GovWin) [S]. https://iq.govwin.com/neo/marketAnalysis/view/8791
- FY2024 small-business prime dollars: **$183.5B** (28.76%, a record) (SBA scorecard via SmallGovCon) [S]. https://smallgovcon.com/reports/fy2024-small-business-scorecard-shows-strong-small-business-federal-contracting-numbers/
- Supplier base is shrinking (Goldman Sachs & Bipartisan Policy Center, 2021, older) [S]:
  - New small-business entrants fell **79%** from 2005 to 2019.
  - Small-business participants fell **38%** over 10 years.
  - https://www.businesswire.com/news/home/20210625005033/en/New-Goldman-Sachs-and-Bipartisan-Policy-Center-Report-Reveals-Systemic-Roadblocks-for-Small-Businesses-in-Federal-Contracting-Process

### SLED
- **90,837 local governments** in the 2022 Census of Governments, rising to **91,438** in 2025 [S]. https://www.census.gov/library/publications/2026/econ/govtorg2225.html
- About 39,555 are special districts; about 12,546 independent school districts [S, secondary].
- NationGraph indexes "over 100,000 state, local, and educational entities".
- Menlo Ventures: "hundreds of thousands of customers sell to the government" (2026-02-25) [VENDOR]. https://menlovc.com/perspective/nationgraph-leveling-the-playing-field-in-government-procurement/
- ClearGov describes a "95,000-account TAM" [VENDOR].

### GovTech sales-tool funding (signals of category demand)
- Starbridge: $52M (Oct 2025).
- GovDash: $30M Series B (Jan 2026).
- Procurement Sciences: $30M Series B (Nov 2025).
- NationGraph: $18M Series A (Feb 2026).
- Pursuit: $22M (Apr 2026).
- GovWell: $25M (May 2026; it sells to governments, so it is an ICP prospect, not a competitor).
- Details in §8.

---

## 8. Competitors: AI tools targeting this segment

| Company | What it does (relevant to our Bots) | Funding | Price | Security claims | Notes and dates |
|---|---|---|---|---|---|
| **Starbridge** (NYC) | SLED + education signals (council minutes, budgets, grants, leadership changes, purchase orders); RFP Finder across "thousands of procurement portals" with scoring, competitor flags and **compliance matrix**; AI proposal writer; Sequences; **bi-directional Salesforce/HubSpot**. | $10M seed + **$42M Series A** (Craft, Oct 2025) = $52M. | Not public. | — | 160+ "enterprise public-sector sales teams" (GovTech, 2025-10-24). Customers include GovTech startups (Zencity, ClearGov, GovWell, Mark43, SimpliGov), so it overlaps our SLED sub-segment directly. In Oct 2025 the CEO cited a Slackbot and CRM access as goals. https://starbridge.ai/lp/ai-gtm-platform-govtech ; https://www.govtech.com/biz/procurement-ai-tech-provider-starbridge-raises-42m |
| **Pursuit** | SLED data aggregation, positioned against GovWin with fresher data and lower-cost self-serve. | **$22M** (2026-04-29; Rosengarten/Builders VC; Gurley, Altman); $25.5M total [S]. | — | — | TechCrunch via aggregators [S]. https://tamradar.com/funding-rounds/pursuit-series-a-22m |
| **NationGraph** | AI procurement intelligence across 100K+ SLED entities. | **$18M Series A** (Menlo, 2026-02-25); $22.5M total [S]. | — | — | https://menlovc.com/perspective/nationgraph-leveling-the-playing-field-in-government-procurement/ |
| **Civic IQ** | SLED pre-RFP signals; claims 50K+ agencies. | — | — | — | Runs heavy comparison content against GovWin and Starbridge [VENDOR]. |
| **Govly** | Federal market network; contract-vehicle (SEWP, CIO-SP, 40+) visibility; teaming workspaces; agents and workflows. | $9.5M Series A (Insight, Nov 2023); about $13.1M total [S]. | Free 30-day window; enterprise custom. | — | https://www.govly.com/pricing |
| **Sweetspot** (YC S23) | Federal (SAM, USAspending, FPDS, DIBBS) + 1,000+ SLED sources; agentic monitors; pipeline with Salesforce; proposal engine that shreds RFPs into compliance matrices; SharePoint library. | $2.2M seed (1984 Ventures, Aug 2024) [S]. | Demo only. | Claims FedRAMP Moderate Authorized, CMMC L2, SOC 2 II. | Customers: Strider, Vantiq, Oshkosh Defense, Playground Global, among others. https://www.sweetspot.so/ |
| **GovDash** | "CRM purpose-built for government contracting": Discover → Capture → Pricer → Proposal → Contract; Dash AI agent; Salesforce sync; Word add-in. | **$30M Series B** (Mucker, BCI; 2026-01-15); about $40M total; nearly 200 customers; revenue up about 16× since its 2024 Series A [S]. | Sales-led; Starter 1 seat, Growth 8+ seats. | FedRAMP Moderate Equivalency; FedRAMP Ready; Azure Government; CUI/DFARS 7012. | Closest analogue to "AI CRM for govcon". Federal and defense focused. https://www.govdash.com/capture/crm ; https://www.govdash.com/security |
| **Procurement Sciences (Awarded AI)** + **Rogue AI** | End-to-end AI growth platform (find, capture, proposal); bought Rogue (proposal drafting) on 2026-02-18. | $10M Series A (Apr 2024) + **$30M Series B** (Catalyst, Nov 2025); about $40M total; "300+ organizations" [S]. | Not found. | **FedRAMP Moderate Authorization** (press release 2026-03-13) [S]. | https://orangeslices.ai/procurement-sciences-acquires-rogue-ai-to-accelerate-end-to-end-ai-growth-platform-for-government-contracting/ |
| **pWin.ai** (McLean, VA) | Shipley-methodology AI proposal workflows; took over **Vultron**'s customers (2026-04-29). | — | — | FedRAMP Moderate Equivalency (claim). | https://briefglance.com/articles/govcon-ai-shake-up-pwinai-acquires-vultronais-customer-portfolio |
| **Vultron** (exited) | AI proposal generation from uploaded solicitations. | $4.85M seed (Craft, Oct 2024) + about $17M Series A (Jul 2025), about $22M total [S]. | — | — | Customer portfolio moved to pWin.ai in Apr 2026. |
| **CaptureAgent** | Built by a defense founder: find, score fit, competitive analysis, price, draft and grade proposals; post-award IMS/CDRL; CMMC/FedRAMP readiness; investor search. Bring-your-own SAM.gov, Anthropic and OpenAI keys; MCP access. | — | Free test access for YC defense founders. | — | Show HN, 2026-08-25. The closest feature match for a founder-led team. https://news.ycombinator.com/item?id=49442327 |
| **Firmenza** | AI for SAM.gov registration/renewal, contract and grant matches, Spanish support. | — | Free while launching. | — | Show HN, 2026-10-16. https://news.ycombinator.com/item?id=50124216 |
| **Incumbent data tools** | GovWin IQ (Deltek), GovSpend, HigherGov, GovTribe (GovExec), Bloomberg Government, Periscope S2G/BidNet, BidPrime; Unanet (CRM + ProposalAI) [name only]. | — | See §4. | — | These are what buyers compare us to on price. |
| **Content-led AI entrants** | SamSearch (self-reported from $199/mo [S]), Gov Contract Finder (free tier [S]), CLEATUS (cleat.ai), GovSignals, GovEagle ($2.5M raise, title only [S]), Granted AI (SBIR grant writing). | — | — | — | Mostly SEO comparison pages. Funding and traction unverified. |

**Gaps we could own (from the evidence above):**
- **Approval loop.** None of the fetched competitor pages mention Slack or SMS approval of Bot actions. Starbridge named a Slackbot as a goal in Oct 2025, so it may exist now.
- **Founder-led small teams.** Most well-funded tools target "enterprise public-sector sales teams" (Starbridge) or proposal departments (GovDash Growth = 8+ seats; pWin.ai talks about large defense contractors). Founder-led 5–30-person teams are served by HigherGov ($500), CaptureAgent and consultants.
- **SLED and SBIR in one place.** SLED-signal tools (Starbridge, Pursuit, NationGraph) don't do SBIR topics. Federal proposal tools (GovDash, Procurement Sciences, pWin.ai) are thin on SLED. Sweetspot comes closest to covering both.
- **Pricing from past awards.** HigherGov has a Labor Pricing Tool and GovDash has a "Pricer" stage. Few tools offer award-based price-to-win for small teams. Check this in demos.
