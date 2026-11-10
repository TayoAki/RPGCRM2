# Talent module: finding and contacting creators and freelancers through supported channels (as of 2026-11-10)

**Scope.** Research done 2026-11-10 for Magpie's "Talent" module. Bots take a content brief (posts, short videos, editing, design), find creators and freelancers, score them, draft outreach with the deal and pay rate, send it after the customer approves, and track replies. Magpie is a multi-tenant SaaS acting for many customers. Constraint: supported APIs and licensed data only, no scraping against platform terms.

**How to read the labels**
- **[V-fetch]**: wording as returned by a page fetch of the cited URL on 2026-11-10. The fetch tool extracts quotes with a small model, so spot-check before reusing in external copy or contracts.
- **[V-doc]**: I downloaded the page and read the text locally.
- **[S]**: from a search-engine summary. The page itself was not opened (often a 403). Treat as near-verbatim at best and verify.
- **[P]**: my paraphrase or my own background knowledge, not re-verified in this pass.
- **Vendor claim**: the only source is the vendor talking about itself. **Competitor claim**: a rival vendor describing another vendor (influencers.club, HypeAuditor and Influencer Hero publish many of these).
- **Unconfirmed**: sources conflict or only one weak source exists.

**Access limits that shaped this file (no workaround attempted)**
- **Upwork** (upwork.com, support.upwork.com, investors.upwork.com) returned 403 to both the fetch tool and curl. Every Upwork fact below is [S].
- **TikTok API for Business docs** (business-api.tiktok.com) and **Freelancer.com developer docs** render only with JavaScript. Endpoint names come from search snippets [S].
- **Fiverr** (fiverr.com/mcp) and **Instagram Help Center** returned 403 or empty pages.
- No legal advice. Section 5 summarises primary law and regulator material for counsel to review.

---

## Strongest findings (one screen)

1. **Meta now has a self-serve, first-party creator search API, and it returns email.** The Instagram Creator Marketplace API reached general availability on **2025-10-01**, and the Facebook Creator Discovery API on 2025-10-06. Access goes through normal app review, not a hand-picked partner list. The creator object has an `email` field ("Creator's email, if available"), plus filters `has_public_contact_email` and `exclude_messaged_creators`.
   - Catch: the brand must be eligible and accept the Creator Marketplace terms, and grants access through Facebook Login.
   - That fits a multi-tenant SaaS: each Magpie customer connects its own brand account.
   - The marketplace went global on 2026-01-30, beyond the earlier 19 countries.
   - Sources: [Meta dev blog](https://developers.facebook.com/blog/post/2025/09/09/instagrams-creator-marketplace-and-facebook-creator-discovery-apis-are-launching-soon-get-ready/), [API doc](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/creator-marketplace).
2. **The licensed creator-data vendors now explicitly allow embedding in a customer-facing SaaS.** None of them allows resale of raw data or handing out API keys.
   - Modash's new API Terms (effective **2026-12-03**) say the customer "may provide its customers and end users with access to functionality and data incorporated into" its products.
   - Influencers.club Terms v2.5 (effective **2026-11-01**) allow customers' customers to "search, browse, filter, save, and export".
   - HypeAuditor's API FAQ: "you can use the HypeAuditor API to add creator data and analytics to your own branded platform."
   - All three make **us (or our customer) an independent controller**, responsible for a lawful basis and for anti-spam law.
3. **Price points differ by an order of magnitude.**
   - Influencers.club: self-serve API from **$208/mo** (validated email + profile = 0.2 credits).
   - Modash Discovery API: from **$16,200/yr** (Raw API from $10,000/yr), annual only, bank transfer only.
   - HypeAuditor, CreatorIQ, Upfluence and Phyllo/InsightIQ: quote-only.
4. **No platform permits cold automated DMs.**
   - Instagram and TikTok business messaging APIs only answer people who wrote first: a 24-hour window on Instagram, 48 hours and up to 10 messages on TikTok [S]. TikTok's API is unavailable to EEA, Swiss and UK business accounts [S].
   - X's developer guidelines name bulk product DMs as spam.
   - The DM-like channels are inside native marketplaces only: TikTok One invites, Instagram Partnership Messages, YouTube Creator Partnerships inquiries. Their APIs are partner-gated.
   - So **email from the customer's own mailbox is the main outbound channel**, plus "prepare in Magpie, send natively" hand-offs.
5. **TikTok has no self-serve route.**
   - The old Creator Marketplace (TCM) API endpoints stopped working **2025-06-30** and were replaced by TikTok One (TTO) endpoints. These include "Discover TTO creators", campaign create/update and video-linking requests.
   - Access is through TikTok partners and reps ("contact your TikTok representative") [S].
   - TikTok's US Terms (updated 2026-07-15) ban scraping "for any purpose" without written approval.
6. **Freelance marketplaces opened to AI agents in 2026.**
   - **Upwork's MCP server** launched 2026-08-10: clients' agents "post jobs, find talent, draft offers, and manage contracts" [S]. **Upwork Now** (instant hire) followed on 2026-11-02.
   - **Contra's MCP** has "60+ tools": search talent, post jobs, send paid proposals, pay invoices. Every write is prepare-then-confirm, and drafts expire after 15 minutes.
   - **Fiverr's MCP** is search-only [S].
   - Their draft-and-confirm models match Magpie's approval step.
   - Upwork's off-platform rules are strict: 24-month non-circumvention, and a conversion fee of 13.5% of estimated annual earnings [S].
7. **UGC marketplaces are closed.** None of Collabstr, Billo, Insense, #paid, Aspire or GRIN offers an API that lets a third party post briefs or invite creators.
   - Aspire's API is two analytics endpoints. GRIN's API is customer-only data sync.
   - Exception worth piloting: **JoinBrands** lists an "MCP Server (Claude, Cursor, VS Code)" in its plans. What it can do (create campaigns or not) is unconfirmed.
8. **Competitors are all racing to "agentic".**
   - Upfluence rebuilt around an agent ("Jaice") in Sep 2026.
   - GRIN launched Gia in May 2025. Archive launched Archie, and raised a strategic round on 2026-09-02.
   - New money: Hypefy AI, $7.2M Series A (2026-07-01). Fluencify, $4.3M pre-seed (2026-09-07), says >$2M ARR. Agentio, $40M Series B (2025-11-18) at a $340M valuation.
   - None of them sells a CRM where the agent spans creators, freelancers and the customer's deals. That is Magpie's opening (inference).

---

## 1. Creator discovery data APIs a SaaS may build on

### Takeaway
Three vendors give a clean licence to embed creator search and contact data in a multi-tenant product: **Influencers.club**, **Modash** and **HypeAuditor**. Each bans standalone resale and sharing API keys, and each makes the customer an independent data controller who must satisfy GDPR, ePrivacy and CAN-SPAM. Emails are "where publicly available". Only Influencers.club says it validates them.

Price and commitment decide v1:
- Influencers.club is monthly from $208.
- Modash is $16.2K/yr minimum.
- HypeAuditor is quote-only.

Phyllo is a different product. It needs each creator to connect their account (OAuth), so it suits an opt-in creator portal, not cold discovery. CreatorIQ, Upfluence, GRIN and Aspire sell platforms, not data feeds.

### Comparison (all read 2026-11-10 unless stated)

| Vendor | Platforms | Contact email | Price | Embedding / resale terms | Label |
|---|---|---|---|---|---|
| **Influencers.club** | Claims 340M+ profiles. Published Discovery counts: IG 97.9M, TikTok 23.4M, YouTube 11.2M, X 123.2M, Twitch 149K (vendor claim) | "Enrich by Handle, Profile (validated email plus contact and vetting fields): 0.2 credits". Enrich by email 0.05. Discovery 0.01/profile | Starter (dashboard only) from **$140/mo**. Pro (API + dashboard) from **$208/mo**. "As low as $0.23" per credit on Pro. Agency custom. Monthly, no annual commitment. FAQ says $199 for dashboard, which conflicts with the grid | v2.5, effective **2026-11-01**. §2.2: may integrate into products offered to own customers, who may "search, browse, filter, save, and export". Bans: "(i) sell or license Creator Data as a standalone data product", "(ii) give any third party direct access to the Influencers Club API". §3.2: must comply with GDPR, ePrivacy, CAN-SPAM and TCPA, and "maintain and honor its own suppression list". §5.4: database "maintained by Influencers Club DOO (North Macedonia) as an independent data controller". §5.1: "compiled from publicly available information" plus "third-party partners" | [V-fetch] [pricing](https://influencers.club/pricing/), [terms](https://influencers.club/terms-of-service/) |
| **Modash** | Discovery: IG and TikTok creators with roughly 1,000+ followers; YouTube with 1,000+ subscribers or 5,000+ average views; "250M+" (help centre) vs "380M+" (pricing page). AI search needs 10K+ followers | Report has a `contacts` array of {type, value} [S, sample response on Modash's Korean docs page]. A competitor says email appears "only when publicly listed; no validation status" (competitor claim). "Search by email" is a reverse lookup (email to profile) at 0.02 credits per match | Discovery API from **$16,200/yr**. Raw API from **$10,000/yr**. Enterprise custom. "we currently don't offer any monthly or pay-as-you-go plans"; bank transfer only; failed requests not charged; unused Discovery credits roll over. Credits: search 0.01/result, AI search 0.025/result, influencer report 1, audience report 1, performance 0.25, collaborations 0.2. [S]: $16.2K = 3,000 credits/mo (about $0.45/credit) and Raw $10K = 40,000 requests/mo, unconfirmed. An earlier search summary put AI search at 0.15 on the English page; the page I fetched says 0.025 | **New API Terms, effective 2026-12-03.** §3.2: "Customer may integrate API Services and API Results into its own applications, products, platforms, databases"; "does not authorize the standalone resale of raw API Results". §3.3: "Customer may provide its customers and end users with access to functionality and data incorporated into" its products, but no direct API access or credentials. §10.5: no "white-label or resell the Modash API". §6.3: "each Party acts as an independent controller". §6.5: must comply with "data protection, privacy, direct marketing and communications laws". §8.4: may cache, must prevent extraction. §12.4: may keep historical results after termination. **Legacy terms (to 2026-12-02):** §10.5 "Customers with an active API subscription are expressly permitted to use the API and Data"; §10.7 derivative products allowed; §6.7 "You are responsible for obtaining necessary consent from the creators before collecting and processing their data" | [V-fetch] [API pricing](https://www.modash.io/influencer-marketing-api/pricing), [help](https://help.modash.io/en/articles/14035513-api-overview-and-getting-started), [terms](https://modash.io/legal/terms-of-service) |
| **HypeAuditor** | Discovery API: IG, TikTok, YouTube, X, Twitch. Reports API: those plus Snapchat | "Get creators' business emails where available"; "HypeAuditor only uses publicly available information and doesn't collect unpublished contact details". Via reports or an "Unlock Report Email" endpoint | Credit-based, "separate from your subscription plan", contact sales. Test key with sandbox. Failed reports refunded; reopening a report within 12 months is free. Platform plans about $299/mo and up [S, third-party]. Pricing page shows Discovery API "Upon request" [S] | FAQ: "you can use the HypeAuditor API to add creator data and analytics to your own branded platform"; branding and display rules handled by sales | [V-fetch] [API page](https://www.hypeauditor.com/api-integration/) |
| **Phyllo** | Lists YouTube, Twitch, TikTok, Snapchat, Instagram, Twitter, Facebook, TikTok Shop, LinkedIn, RedNote (vendor claim) | Not a contact-data product. Value is "non-public, consented insights" via its Linkage SDK ("Connect a user's social media profiles to your app") | Custom quote only. [S]: about $199/mo entry. Competitor claim: "sandbox free, production ~$20K/yr" | No licence text found on the pricing page. Data is "Completely creator-consented" (vendor claim) | [V-fetch] [API page](https://getphyllo.com/influencer-marketing/api), [pricing](https://www.getphyllo.com/pricing) |
| **InsightIQ** | Public-data discovery, "57 documented filters on Instagram, YouTube and TikTok" (competitor claim) | `contact_details` = "an array of {type, value} strings returned as found", no validation (competitor claim) | API on Enterprise only, custom. About $0.50 per analysed profile, "reported by buyers" (competitor claim) | Competitor FAQ: Phyllo and InsightIQ are "one company, two brands": Phyllo is the OAuth Connect SDK, InsightIQ sells public data. **Unconfirmed**; I found no first-party statement | [influencers.club compare page](https://influencers.club/compare/insightiq-api-vs-influencers-club-api) |
| **Upfluence** | API returns IG, TikTok and YouTube creator data; the spec also lists X, Pinterest and Twitch (competitor reading of Upfluence docs, retrieved Aug 2026) | Search returns a has-email boolean; the address sits behind an "unlocked" flag (competitor claim) | Tokens bought from the account manager. "our minimum contract is 12 months". Token rates: 500 search results, 5 profiles or 1 audience report per token. Plan price unpublished. [S]: Scale $19,800/yr, Enterprise $42,600/yr, unconfirmed. MCP server "currently in beta", on request | No embedding terms found | [competitor page](https://influencers.club/compare/upfluence-api-vs-influencers-club-api). One Trustpilot review alleges $5K spent on an API that "never worked" [S] |
| **CreatorIQ** | Enterprise platform. Integrated YouTube's Creator Partnerships API (Mar 2026) and was an early Instagram Creator Marketplace API partner [S] | n/a | Competitor estimate about $30K to $36K/yr. API keys via your CreatorIQ contact [S] | A platform with about 20 APIs (Campaign, Lists, Payouts, Social, Brand Safety) [S, apis.io]. Not a data feed to resell | [S] |
| **Others** | CreatorDB (self-serve credits, no email, competitor claim); Traackr (about $32.5K+/yr, competitor claim); Influencer Hero (API through sales, "From $249/month", competitor claim); GRIN (no standalone data API) | | | | [influencers.club blog, 2026-02-09](https://influencers.club/blog/influencer-marketing-apis/), vendor-ranked |

### Inferences
- **Contact emails are licensed for embedding but not "cleared" for outreach.** Every vendor pushes the anti-spam and GDPR burden to the customer. Modash's legacy §6.7 even says the customer must obtain "necessary consent from the creators". So Magpie needs its own compliance layer (section 5) whichever vendor we pick.
- **Influencers.club has the best fit on paper:** monthly billing, explicit embedding rights, validated emails, X coverage. Its controller is a North Macedonian entity (DOO). A separate "Schedule M" document on firecrawl.dev names yet another entity, "OneMore InfluencersClub OÜ" [S]. Check provenance and the DPA before signing.
- **Modash is the safer enterprise name** with the larger first-party reputation. The $16.2K/yr minimum only makes sense once Talent has paying users.
- **Phyllo-style permissioned data is the long-term moat.** Creators who connect their accounts (opt-in) give verified stats and consent, which fixes both data quality and lawful basis.

### Gaps
- No official Modash schema showing whether `contacts` returns email on the Discovery API, and how often. Get test credits and measure email fill-rate on a sample of 500 creators in our customers' niches.
- Influencers.club DPA, sub-processors and email-validation provider not reviewed.
- HypeAuditor, CreatorIQ, Upfluence and Phyllo/InsightIQ: no list prices. Quotes needed.
- No independent audit of any vendor's database size or email accuracy.

---

## 2. Platform-native routes (TikTok, Meta, YouTube, X)

### Takeaway
- **Instagram and Facebook:** a usable first-party API exists, the Creator Marketplace API. It is gated by app review plus brand eligibility. Business Discovery adds metrics for a known username, but no email.
- **TikTok:** creator APIs (TikTok One) exist but only for TikTok partners via reps.
- **YouTube:** the Data API is fine for enrichment and vetting, but has tight search quota, a 30-day storage rule and no email. Its new Creator Partnerships API is limited to about 17 to 24 selected partners.
- **DMs:** no platform allows cold automated messages.

### TikTok

| Item | Finding | Date | Label / source |
|---|---|---|---|
| TCM to TTO | "starting June 30th, 2025, you can no longer use TikTok Creator Marketplace endpoints", replaced by TikTok One API endpoints | 2025-06-30 | [S] [API for Business docs](https://business-api.tiktok.com/gateway/docs/index?identify_key=c0138ffadd90a955c1f0670a56fe348d1d40680b3c89461e09f78ed26785164b&language=ENGLISH&doc_id=1735827019995138) |
| What TTO API covers | "The Organic API comprises the Accounts, Mentions, TikTok One (TTO), Discovery, and Spark Ads Recommendation APIs"; use case "Creator discovery and order management" | Help page updated Sep 2025 | [V-fetch] [About API for Business](https://ads.tiktok.com/help/article/marketing-api?lang=en) |
| Endpoints seen | "Discover TTO creators" (under "Creator insights and discovery", with rankings and search labels); "Create or update a TTO Creator Marketplace campaign"; send/revoke "TTO video linking request"; creator-side join campaign and approve/reject linking. Some features are "allowlist-only … contact your TikTok representative". Campaigns created via API do not show their reporting in the TTO UI | 2026 | [S] [discover endpoint](https://business-api.tiktok.com/portal/docs/discover-tto-creators/v1.3), [campaign endpoint](https://business-api.tiktok.com/portal/docs/create-or-update-a-tto-creator-marketplace-campaign/v1.3) |
| Who gets access | No public criteria. Sprout Social says it has "exclusive access to the TikTok One API" as a badged partner [S]. The Creator Marketing badge of the TikTok Marketing Partners program is tied to the API [S, AnyMind 2023] | 2023 to 2026 | [S] |
| TikTok One product | "partners can tap into the platform's most powerful features from their preferred workstreams"; discovery with "advanced filters, curated highlights, or open casting calls"; "scaled campaigns with automated briefing". The blog does not mention messaging | 2026-05-13 | [V-fetch] [TikTok One blog](https://ads.tiktok.com/business/en-US/blog/tiktok-one-creative-platform) |
| Partner example | Brandwatch Influence: users can "invite the TikTok account to TikTok's Creator Marketplace via the button available in the CRM profile"; creators authenticate; keyword detection of campaign posts is ending | 2026-02-17 | [V-fetch] [Brandwatch help](https://influence-help.brandwatch.com/en/articles/12414758-influence-s-integration-with-the-tiktok-creator-marketplace-ttcm-api) |
| Messaging | Business Messaging API (from integrators' docs): customers must start the chat; 48-hour window; up to 10 messages; business accounts in the EEA, Switzerland and UK cannot use the API for DMs; Advanced Access needed | 2026 | [S] [respond.io](https://respond.io/help/tiktok/tiktok-overview), [Chatwoot](https://www.chatwoot.com/hc/user-guide/articles/1769595702-how-to-setup-a-tik_tok-channel) |
| Terms | §3.4: must not "scrape, crawl, export or otherwise extract any data or content in any form, for any purpose" without written approval of "TikTok USDS Joint Venture" | Last updated 2026-07-15 | [V-fetch] [TikTok US ToS](https://www.tiktok.com/legal/page/us/terms-of-service/en) |
| TikTok Shop affiliate APIs | Partners can create open and targeted affiliate collaborations, with search and discovery (2024 launch). One guide claims up to 1,000 target invites per 24 hours, unverified. Only useful for customers who sell on TikTok Shop and pay commission | 2024 to 2026 | [S] [TikTok dev blog](https://developers.tiktok.com/blog/2024-tiktok-shop-affiliate-apis-launch-developer-opportunity) |

### Meta (Instagram and Facebook)

| Item | Finding | Date | Label / source |
|---|---|---|---|
| Launch | Instagram Creator Marketplace API GA **2025-10-01**; Facebook Creator Discovery API GA **2025-10-06**; "Search for creators using keywords or filters" plus creator insights; access after app review | Blog 2025-09-09 | [V-fetch] [Meta dev blog](https://developers.facebook.com/blog/post/2025/09/09/instagrams-creator-marketplace-and-facebook-creator-discovery-apis-are-launching-soon-get-ready/) |
| Fields and filters | `email`: "Creator's email, if available". `biography`, `country`, gender and age bucket (onboarded creators only), audience insights. Filters include follower range, country/state, interests, engagement, audience demographics, `similar_to_creators`, `custom_audience_id`, `has_public_contact_email`, `exclude_messaged_creators`, `featured_in_paid_ads`, `creator_language` | Current doc | [V-fetch] [API doc](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/creator-marketplace) |
| Gating | Permissions: `instagram_creator_marketplace_discovery` (advanced access), `instagram_basic`, `pages_manage_metadata`, `pages_show_list`, `business_management`. Standard access returns test data only. The brand grants access via Facebook Login and must "accept the Instagram Creator Marketplace Terms of Service". Ineligible brands get error 10 | Current doc | [V-fetch] same |
| Rate limits (**unconfirmed**) | The doc says "Requests are capped at 5000 per user per hour". The changelog says Discovery limits "increased from 240 to 1,000 queries per user per hour" | Changelog 2026-03-30 | [V-fetch] [changelog](https://developers.facebook.com/documentation/instagram-platform/changelog) |
| 2026 additions | `profile_picture_url`; a creator's past partnership-ads media; follower-growth, activity and device filters; creators can generate partnership ad codes via API (2026-03-30). "Paid partnership" label via the Content Publishing API (2026-04-22) | 2026 | [V-fetch] changelog |
| Messaging and Projects APIs | 2024 test with Aspire, Captiv8 and CreatorIQ: a Messaging API "to send messages into the Partnership Messages inbox … directly from a third-party platform", and a Projects API to publish briefs. Neither appears in the current public docs or changelog, so treat them as partner-only | 2024 | [S] [Instagram business blog](https://business.instagram.com/blog/creatormarketplaceAPI), [SMT](https://www.socialmediatoday.com/spons/instagrams-new-creator-marketplace-api-and-how-to-use-it/647552/) |
| Reach | Marketplace "expanded globally, beyond the 19 countries" | 2026-01-30 | [S] [Buzzincontent](https://www.buzzincontent.com/news/meta-enhances-instagram-and-facebook-tools-for-creator-collaborations-11069426) |
| Business Discovery | Works only on Business and Creator accounts and needs the target username. Public fields include `biography`, `followers_count`, `media_count` and `website`. No email field is listed (inference from the IG User reference). Rate-limit figures conflict across blogs | Doc + 2026 changelog | [S] [Business Discovery doc](https://developers.facebook.com/docs/instagram-api/business-discovery) |
| Messaging API | Conversations start when a person messages; "For most user actions, it lasts 24 hours"; a tag allows replies outside the window; non-follower messages land in Requests | Current doc | [V-fetch] [IG messaging overview](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/overview) |
| Partnership ads | Partnership Ads API (boost by media ID or ad code; `instagram_branded_content_ads_brand`). Facebook Partnership Ads API reported Dec 2025 | 2025 to 2026 | [S] [doc](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation) |
| Scraping terms | Meta's Automated Data Collection Terms (effective 2024-10-07) require express written permission. Instagram terms bar "collecting information in an automated way without our express permission" | 2024 | [S] |

### YouTube

| Item | Finding | Label / source |
|---|---|---|
| Quota | "default quota allocation of 100 `search.list` calls", "100 `videos.insert` calls, and 10,000 units per day combined for all other endpoints"; more via a quota extension request form | [V-fetch] [getting started](https://developers.google.com/youtube/v3/getting-started), read 2026-11-10 |
| Storage | III.E.4.c: "After 30 calendar days, the API Client must either delete or refresh the stored data" | [V-fetch] [developer policies](https://developers.google.com/youtube/terms/developer-policies) |
| Scraping and resale | III.E.6 bans scraping. III.G.1.a: no "sell, purchase, lease, lend, convey, redistribute, or sublicense" of the API services. III.E.2.a limits aggregating API data across content owners; check which data class it covers | [V-fetch] same |
| Email | The channel resource has no email field. The creator's business email sits behind the "View email address" step on the channel page | [P], not re-verified this pass |
| Creator Partnerships (ex-BrandConnect) | "We're evolving our tools into a centralized platform"; "select partners can bring these exact capabilities into their own tools"; Gemini-powered discovery; advertisers "soon will be able to send inquiries to multiple creators at once" | [V-fetch] [YouTube blog, 2026-03-23](https://blog.youtube/news-and-events/youtube-creator-partnerships-newfronts-2026/) |
| Partner gate | 24 partners per a 2026-03-30 report vs 17 approved partners per a 2026-06-02 report; "no self-serve API for brands"; "data access but no commerce tools" | [S] [pulse.bot summaries](https://www.pulse.bot/media/news/youtube-lists-17-creator-partnerships-api-partners-as-advertiser-access-remains-controlled-a8c99790-1f71-4810-be00-f8912d4a3e85/), unconfirmed |

### X, LinkedIn
- **X:** the developer policy asks for explicit consent before automated DMs. The guidelines give "an app that bulk-DMs users about a product launch" as not allowed [S] ([developer guidelines](https://docs.x.com/developer-guidelines), [policy](https://docs.x.com/developer-terms/policy)).
- **LinkedIn:** not researched as a creator source. See the LinkedIn cases in section 5.

### Can Bots send automated DMs?
**No, on any platform, for cold outreach.**
- Instagram and TikTok messaging APIs only answer people who wrote first.
- X bans unsolicited automated bulk DMs.
- YouTube has no DM API.

The permitted "DM" channels are inside native marketplaces: Instagram Partnership Messages, TikTok One invitations, YouTube Creator Partnerships inquiries. Their APIs are limited to selected partners.

### Inferences
- **Build the Instagram Creator Marketplace integration in v1.** It is free, first-party, consent-aligned (creators opt into the marketplace) and returns email where available. Each customer connects its own brand via Facebook Login, which fits multi-tenancy.
  - Risks: app review, brand eligibility, and the marketplace terms' data-use rules (not read; see gaps).
- **For TikTok, start the TikTok Marketing Partner (Creator Marketing) application now** and expect months. In v1, use vendor data for TikTok discovery and deep-link the customer into TikTok One to send invites manually.
- **For YouTube, use the Data API only to enrich and vet** creators we already have from a vendor or from Meta: recent views, upload cadence, topic. Respect the 30-day refresh rule in our cache.

### Gaps
- Text of the Instagram Creator Marketplace Terms of Service, including any limits on storing creator data, contacting by email, and agency/SaaS use.
- Eligibility rules for TTO API access and whether "Discover TTO creators" itself is allowlisted.
- The YouTube Creator Partnerships API partner list and how to apply.

---

## 3. UGC marketplaces and their partner/API programs

### Takeaway
**No UGC marketplace lets a third-party app post briefs, invite creators or receive applications on a brand's behalf through a documented API**, as of 2026-11-10. These platforms protect their take rate (10% to 15% fees) and keep chat and payments in-house. The realistic v1 pattern is to draft the brief in Magpie, deep-link the customer to post it on the marketplace, and track the result manually or by email notifications.

The one opening is **JoinBrands' MCP server**. Pilot it if it can create campaigns.

| Marketplace | API / partner route | Fees / pricing | Off-platform rules | Label / source |
|---|---|---|---|---|
| **Collabstr** | No public API found | Free to browse and hire with a 10% marketplace fee on brand purchases; paid plans with conflicting prices ($99 to $399/mo); creators pay about 15% | Terms (updated 2025-09-09): Collabstr is "not a party to any agreement" except "collecting and processing payments". Feature page: "All communication happens inside Collabstr" | [S] [terms](https://collabstr.com/terms), [chat feature](https://collabstr.com/features/chat-and-negotiate/) |
| **Billo** | GetApp: no API | n/a | n/a | [S] [GetApp](https://www.getapp.com/marketing-software/a/billo/) |
| **Insense** | No public API; Meta and TikTok ad-manager transfer and Shopify; custom integrations "can be discussed" | n/a | n/a | [S] [adtribute](https://www.adtribute.io/directory/insense) |
| **JoinBrands** | Pricing grid lists "MCP Server (Claude, Cursor, VS Code)" and Shopify under Integrations [V-doc]. Help article: endpoint `https://api.joinbrands.com/mcp`, OAuth sign-in; "read information from your JoinBrands account"; campaign creation **unconfirmed** [S] | llms.txt (vendor): Pay-as-you-go $0/mo with a 15% platform fee; Start-up $99/mo, 12%; Brand $299/mo, 10%; Agency $499/mo, 8%. The live pricing page now shows tiers named Free / Start-up / Pro / Max, so names have changed. Claims 25,000+ creators in US/UK/DE/AU/CA; "UGC images start at $15+, TikTok videos at $100+" | Escrow and in-app chat (vendor) | [V-doc] [llms.txt](https://joinbrands.com/llms.txt), [pricing](https://joinbrands.com/pricing), [S] [MCP help](https://help.joinbrands.com/en/articles/15138576-introducing-the-joinbrands-mcp-server-connect-your-account-to-claude-other-ai-tools) |
| **Trend.io, Statusphere** | Nothing found in the search | n/a | n/a | Gap |
| **#paid** | API Evangelist (checked Aug 2026): "publishes no public developer program, API reference". Its "Creator Discovery API" news (Jan 2025) is about Snapchat integration. Pinterest execution partner (2026-03-18) | n/a | n/a | [S] [API Evangelist](https://providers.apievangelist.com/providers/hashtag-paid/), [PR Newswire](https://prnewswire.com/news-releases/paid-announces-new-creator-discovery-api-and-expanded-partnership-with-snapchat-in-north-america-302362141.html) |
| **Aspire** | "The Aspire API currently provides two analytics endpoints" (`/v1/posts`, `/v1/members`); "designed primarily for business intelligence (BI) and analytics teams"; keys in workspace settings. No creators, applications or messaging | Not stated | n/a | [V-fetch] [Aspire API FAQ](https://help.aspireiq.com/en/articles/14789264-frequently-asked-questions-the-aspire-api) |
| **GRIN** | Customer API key, bi-directional REST to sync creators, content, programs and reports; "does not require a partnership" (Alloy). Not a marketplace for outsiders | Enterprise; also a self-serve "GRIN with Gia" with credits (competitor claim) | n/a | [S] [Alloy connector](https://docs.runalloy.com/connectors/Grin) |

### Inferences
- **Treat UGC marketplaces as hand-off destinations, not data sources.** If a customer already has an account there, Magpie can prepare the brief and the offer and hand off. Creators found on a marketplace should be contracted and paid there.
- **The MCP pattern is spreading:** JoinBrands, Upwork, Contra, Fiverr, Upfluence beta. Magpie's Bots should be able to act as an MCP client against each customer's own marketplace account. That is likely the permitted way to "use" these platforms from an agent, subject to each one's terms on third-party AI tools.

### Gaps
- JoinBrands MCP tool list. It needs an account to see.
- Partner programs at Billo, Insense, Trend and Statusphere. Email their partnerships teams.
- Collabstr's full "User Conduct" section.

---

## 4. Freelancer marketplaces (editing, design, short-form production)

### Takeaway
**Upwork is the only large marketplace with both an OAuth API for third-party apps and an agent channel (MCP).** Clients can post jobs, find talent, draft offers and manage contracts. Upwork keeps the binding steps with the user. Contra's MCP is the cleanest agent-native path and charges freelancers no commission. Fiverr's MCP is search-only. Malt's API is billing and SCIM only. Freelancer.com has a broad public API. Toptal has none.

On all of them, **hiring and payment must stay on-platform**: Upwork has a 24-month non-circumvention period and a conversion fee, and Fiverr bans off-platform deals.

### Upwork (all [S]: upwork.com returned 403 on 2026-11-10)

**API access**
- Clients and freelancers "on any membership plan can request access".
- Conditions: verified ID, non-duplicate request, "daily request limit of 40,000 API requests", and no Upwork branding.
- Requests are reviewed manually. ([support article](https://support.upwork.com/hc/en-us/articles/115015857647))
- Auth: "we support the OAuth 2.0 method". Changing an app's permissions invalidates existing tokens.

**API scope**
- From the developer site: "Automate the creation and management of jobs posted on Upwork" and "Search for a match on the Talent Marketplace as a Client, Agency, or Freelancer", plus offers and contracts ([developer docs](https://www.upwork.com/developer/documentation/graphql)).
- An unofficial Node client exposes `contracts.createOffer`.
- GigRadar (vendor, 2026-09-04): "Upwork's public GraphQL API has no mutation for submitting a proposal". That concerns the freelancer side.

**MCP server (launched 2026-08-10)**
- Clients can "post jobs, find talent, draft offers, and manage contracts".
- "available today for every Upwork client and freelancer, at no additional cost" ([Upwork press](https://investors.upwork.com/news-releases/news-release-details/upwork-talent-now-everywhere-ai-works)).
- Upwork Now public beta (2026-11-02) "connects any AI agent or client with Upwork freelancers who are online and ready to start work immediately" [V-fetch, [PYMNTS](https://pymnts.com/earnings/2026/upwork-embeds-freelance-marketplace-inside-top-ai-tools)].
- Vendor-claimed: weekly active users up 20x since launch, nearly 50M agent requests.

**MCP Beta terms (July 2026, per ConductAtlas; several clauses since marked withdrawn; unconfirmed)**
- Invitation-only; "credentials … are personal to you and are not transferable".
- Three tiers: Read, Draft-Confirm (posting jobs and sending messages need user approval), Binding (by the authenticated user, on an Upwork page).
- "agents cannot move money or finalize contracts autonomously".
- Agent-made messages and job posts "must clearly state that an agent created it".
- Names Claude, Claude Code and Cursor as example AI tools.

**Off-platform rules**
- 24-month "Non-Circumvention Period" from the start of an Upwork relationship.
- Conversion fee: "13.5% of a freelancer's estimated annual earnings", computed as hourly rate × 2,080 hours. Example: $30/hr gives $8,424. A reduced fee is possible.
- Off-platform without the fee "can result in permanent account suspension".
- Sources: [conversion fee article](https://support.upwork.com/hc/en-us/articles/360043723533-What-is-the-Upwork-Conversion-Fee), [why can't I get paid directly](https://support.upwork.com/hc/en-us/articles/360048105134).

### Others

| Marketplace | Route | Finding | Label / source |
|---|---|---|---|
| **Contra** | MCP (and an API behind it) | Agents can "search talent by role, skills, expertise, and location", "post jobs, review candidates", "send inquiries or paid project proposals, and pay invoices", read and send messages; "60+ tools". Writes are prepare-and-confirm: "Nothing is executed until you explicitly approve it"; drafts expire after 15 minutes. Hosted use needs OAuth. "commission-free" for independents (vendor) | [V-fetch] [Contra MCP page](https://contra.com/features/mcp), stamped 2026-11-10 |
| **Fiverr** | MCP (search) | `https://mcp.fiverr.com/mcp` "lets an AI agent search Fiverr's marketplace on your behalf and return relevant freelancers"; page updated 2026-08-25. On the Q3 2026 call, Fiverr said it launched its "first public APIs, CLIs, and MCP integrations". Ordering via agent is unconfirmed | [S] [fiverr.com/mcp](https://www.fiverr.com/mcp) (403 to fetch) |
| | Off-platform | "all transactions must occur within the Fiverr platform"; sharing email or phone to do business off-platform is prohibited | [S] [Fiverr off-platform policy](https://help.fiverr.com/hc/en-us/articles/38728907371665-Community-Standards-Off-platform-policy) |
| **Freelancer.com** | Public REST API, OAuth 2.0 | Projects, bids, contests, users, messages, milestones. Developer docs are JS-rendered, so not verified | [S] [publicapi.dev](https://publicapi.dev/freelancer-api) |
| **Malt** | Enterprise API | "credential-gated" API for invoices, payments and SCIM user provisioning, plus 85+ ERP integrations. No talent-search endpoint found | [S] [apis.io](https://apis.io/providers/malt/) |
| **Toptal** | None | No public hiring API. Affiliate program pays about $2,000 per referred client | [S] [revshare.so](https://www.revshare.so/programs/advertiser/toptal) |

### Which give a compliant path to hire?
1. **Upwork, via per-customer OAuth (GraphQL) or the customer's own MCP connection.** The customer stays the Upwork client of record. Magpie drafts the job, invite and offer; the customer confirms; contract and payment stay on Upwork.
2. **Contra MCP or API.** Same pattern, with no freelancer commission and a built-in confirm step.
3. **Fiverr:** search via MCP, then link out for the order.
4. **Freelancer.com API:** works technically, but its talent pool for social content is weaker (inference).

### Inferences
- **A multi-tenant SaaS acting as the "AI tool" for many Upwork clients may conflict with the MCP Beta's "personal, non-transferable credentials"**, if that clause still stands. The documented third-party path is the OAuth API, where each customer authorises Magpie's registered app. Apply for an Upwork API key early.
- **Never let the Bots move an Upwork- or Fiverr-sourced freelancer into Magpie's own email outreach.** Tag every contact with its source and enforce "source = marketplace, so channel = marketplace" in the outreach engine.

### Gaps
- Upwork's API Terms of Use and User Agreement text, the MCP Beta terms as now published, and the exact GraphQL mutations for job posting, invite and offer. A person with a browser should read upwork.com/legal and the GraphQL schema explorer.
- Fiverr MCP and API terms for third-party apps.
- Freelancer.com API terms (resale, data storage).

---

## 5. Contacting creators found through public profiles: legality and platform terms

### Takeaway
Emailing a creator's **published business email** about a paid collaboration is defensible in the US and Canada, and arguably in Germany, if done right. In the EU and UK it rests on legitimate interest and is genuinely unsettled where the creator is a **sole trader** and the message reads as marketing. Platform terms forbid collecting those emails ourselves by automation. Buying them from a licensed vendor moves the collection risk to the vendor, but **not** the outreach-law risk, which stays with us and the customer as independent controllers.

### Email law

| Regime | Finding | Label / source |
|---|---|---|
| **US CAN-SPAM** | "the law makes no exception for business-to-business email"; primary-purpose test; must include "your valid physical postal address"; honour opt-outs within 10 business days; penalties "up to $53,088" per email | [S] [FTC compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) |
| **EU GDPR** | Legitimate interest (Art. 6(1)(f)) can cover outreach after a three-step test: interest, necessity, balancing. EDPB Guidelines 1/2024 (draft adopted 2024-10-08; consultation to 2024-11-20) say electronic direct marketing falls under ePrivacy consent rules, which Art. 6(1)(f) cannot override. Art. 14(3)(b): when data not collected from the person is used to communicate with them, the privacy notice is due "at the latest at the time of the first communication". Art. 21(2)–(3): absolute right to object to direct marketing | [S] [Morgan Lewis summary](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2024/10/gdpr-when-can-data-controllers-rely-on-legitimate-interests-for-data-processing-new-guidelines-from-the-edpb); Art. 14 and 21 text [P] |
| **UK PECR** | Sole traders and some partnerships count as "individual subscribers", so unsolicited marketing email generally needs consent. Corporate bodies can be emailed without consent. ICO definition of direct marketing: "the communication (by whatever means) of advertising or marketing material which is directed to particular individuals"; whether a message is marketing turns on "phrasing, tone and context". Contact details from public sources rarely qualify for the soft opt-in | [S] [LegalVision](https://legalvision.co.uk/data-privacy-it/freely-send-marketing-emails/), [Reed Smith](https://viewpoints.reedsmith.com/post/102ibui/new-ico-marketing-guidance-what-you-need-to-know) |
| **Germany UWG §7** | BGH, 17.7.2008, I ZR 75/06 ("Royal Cars"): commercial inquiries to buy goods or services count as "Werbung" (advertising), **but** a business that publishes its fax or email impliedly consents to purchase inquiries about its normal business, so such an inquiry is not an unreasonable nuisance | [V-fetch] [IWW summary](https://www.iww.de/asr/archiv/wettbewerbsrecht-gewerbliche-nachfrage-per-telefax-und-e-mail-zulaessig-f20314) |
| **Canada CASL s.10(9)(b)** | Consent is implied if the address was conspicuously published, carries no "no unsolicited messages" statement, and the message is relevant to the person's business role. CompuFinder (Federal Court of Appeal): the rule "does not permit the mining of email addresses from third-party directory websites". The sender carries the burden of proof, so keep screenshots and dates | [S] [Mondaq](https://www.mondaq.com/canada/privacy-protection/541038/dear-casl-when-can-i-rely-on-implied-consent), [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm) |

### Platform terms on collecting emails
- **Meta:** Automated Data Collection Terms (2024-10-07) need express written permission [S].
- **TikTok:** US ToS §3.4, "for any purpose" (2026-07-15) [V-fetch].
- **YouTube:** Developer Policies III.E.6 bans scraping [V-fetch].
- **Data vendors** say they use only "publicly available" information (HypeAuditor, Influencers.club §5.1). How they collect it is their risk under the platforms' terms. The new Modash terms (§6.3) and Influencers.club (§5.4) say the vendor is an independent controller of its database.

### Scraping cases and what they imply

| Case | What happened | Date | Label / source |
|---|---|---|---|
| Meta v. Bright Data (N.D. Cal.) | Judge Chen: Meta's terms apply to logged-in use; "the Terms cannot bar Bright Data's logged-off scraping activities". Meta dropped the case a month later | 2024-01-23; dropped about 2024-02-23 to 26 | [S] [TechCrunch](https://techcrunch.com/2024/02/26/meta-drops-lawsuit-against-web-scraping-firm-bright-data-that-sold-millions-of-instagram-records), [Goldman blog](https://blog.ericgoldman.org/archives/2024/01/game-on-bright-data-scores-major-victory-in-web-scraping-dispute-with-meta-guest-blog-post.htm) |
| X Corp v. Bright Data (N.D. Cal. 3:23-cv-03698) | Dismissed with leave to amend: scraping-based contract claims preempted by copyright. Amendment later allowed only for server-impairment ("access") claims. Bright Data counterclaimed, including antitrust, in Dec 2024. No 2025–2026 ruling found | 2024-05-09; Jan 2025 update | [S] [Proskauer](https://newmedialaw.proskauer.com/2024/05/14/california-court-issues-another-noteworthy-decision-dismissing-breach-of-contract-and-tort-claims-in-web-scraping-dispute/), [Goldman blog](https://blog.ericgoldman.org/archives/2025/01/catching-up-on-the-heavyweight-scraping-battle-between-x-and-bright-data-guest-blog-post.htm) |
| LinkedIn v. Proxycurl | LinkedIn alleged fake accounts and scraping of millions of profiles; "successfully resolved"; Proxycurl shut down around 2025-07-04 | Jul 2025 | [S] [LinkedIn news](https://news.linkedin.com/2025/LinkedInWinsLegalBattleToProtectMemberData) |
| LinkedIn v. ProAPIs | Parties "exploring an early resolution" (filing of 2025-12-08). Outcome unknown | Dec 2025 | [S] [Bloomberg Law](https://news.bloomberglaw.com/artificial-intelligence/linkedins-war-against-bot-scrapers-ramps-up-as-ai-gets-smarter) |
| hiQ v. LinkedIn | Ended in 2022 with hiQ found in breach of the user agreement (after the earlier CFAA rulings in hiQ's favour) | 2022 | [P], not re-verified |
| CNIL v. KASPR (France) | **€240,000 fine.** Collecting LinkedIn contact details that users had limited to their connections had no legal basis (Art. 6). Also breaches of retention, transparency (Art. 12, 14) and access (Art. 15). Ordered to delete. Database of about 160M contacts | Decision 2024-12-05; published 2024-12-19 | [S] [CNIL](https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000), [EDPB](https://www.edpb.europa.eu/news/data-scraping-french-supervisory-authority-fined-kaspr-eu240-000_en) |

### Inferences (counsel to confirm)
1. **The US cases help scrapers, not us.** Bright Data won narrow, fact-specific rulings on contract and copyright preemption for *logged-out* public data. LinkedIn wins against fake-account scrapers. None of them makes later *use* of personal data lawful in the EU. KASPR shows EU regulators fine contact-data tools that exceed what people "could reasonably expect". **Do not scrape.** License data, and prefer first-party channels (the Instagram marketplace, where creators opted in to brand contact).
2. **Frame outreach as an offer to buy the creator's service** ("we'd like to commission 3 TikTok videos at $X each"), not as a product pitch. This fits BGH Royal Cars (purchase inquiry to a published business address), CASL's role-relevance test and the ICO's "phrasing, tone and context" test better. The PECR and ePrivacy question for sole-trader creators in the UK and EU remains open, so be conservative there: one message, no follow-up sequence unless they reply, easy opt-out.
3. **Compliance features the Bots must have (v1):**
   - Send only from the customer's own mailbox and domain.
   - CAN-SPAM footer with postal address and a working opt-out honoured at once.
   - A first-email GDPR Art. 14 notice: who we are, source of data (e.g. "your public Instagram business email via [vendor]"), purpose, right to object.
   - A **cross-tenant "do not contact" list**: a creator who objects to one Magpie customer should not be cold-emailed by every other customer.
   - Log the source and publication evidence per contact (CASL burden of proof).
   - Per-country rules: no cold email to DE, UK or EU sole traders unless the address is a published business address.
   - A human approval gate before every first contact.
   - Send-rate caps.

### Gaps
- No regulator guidance found on whether **offering paid work to a creator** is "direct marketing" under PECR or ePrivacy. Needs counsel.
- Final EDPB legitimate-interest guidelines not confirmed as adopted.
- No influencer-database-specific enforcement found. A vendor blog's claim of a "€5.5 million" French fine on a creator-data aggregator is **unverified** and should not be repeated.

---

## 6. Competitors doing AI-driven creator sourcing and outreach (2025–2026)

### Takeaway
Every incumbent now markets an "agent" that does discovery, outreach, negotiation and payments. All of them are influencer-marketing platforms sold to brands' influencer teams, mostly on annual contracts with prices from about $2K to $40K+ per year. New entrants are agent-first and well funded. Nobody combines creators **and** freelancers (editors, designers) in the same agent, inside the customer's CRM and deal pipeline, at SMB prices. That is the gap Magpie can take (inference).

| Company | What the agent automates | Price | Funding | Label / source |
|---|---|---|---|---|
| **Upfluence** | Platform rebuilt on 2026-09-11 around agent "Jaice" (also spelled "Jace"): studies the brand's site and past campaigns, finds creators, pitches "without a human writing each message", negotiates rates. Company claims setup drops from 6 weeks to 5 minutes | Not public; 12-month minimum; [S] $19,800/yr Scale, $42,600/yr Enterprise, unconfirmed | n/a | [V-fetch] [selfemployed.com citing AdExchanger, 2026-09-30](https://www.selfemployed.com/?p=104998). Vendor claims |
| **Modash** | AI search, email lookup, payments, affiliate links; acquired Promoty (date unknown) | Platform from $199/mo [S]; API above | $12M Series A, 2024-10-31, led by henQ | [S] [Vestbee](https://vestbee.com/insights/articles/modash-raises-12-m) |
| **GRIN** | "Gia" (launched 2025-05-20): Skills, Coaches, Workflows; Workflows run discovery, outreach, activation and retention end-to-end | Enterprise annual; self-serve "GRIN with Gia" credits (competitor claim) | n/a | [S] [Business Wire](https://www.businesswire.com/news/home/20250520826786/en/GRIN-Launches-Gia-the-First-Agentic-AI-Solution-Designed-to-Supercharge-Creator-Marketers) |
| **Aspire** | AI Instagram discovery built on Meta's Creator Marketplace API (Oct 2025); CreatorAds suite for partnership ads | Not public | n/a | [S] [TechIntelPro](https://techintelpro.com/news/ai/enterprise-ai/aspire-meta-launch-ai-instagram-creator-discovery-tool) |
| **Influencer Hero** | AI outreach templates, automated follow-ups, deliverability reports | Sources conflict: $249, $519, $649 or about $2,000/mo | n/a | [S] [Archive blog](https://archive.com/blog/influencer-hero-pricing), competitor-adjacent |
| **Creator.co** | "AI-powered platform to find, manage, and scale" campaigns | Conflicting: $100, $199 (3-month minimum) or $460/mo self-serve | n/a | [S] [ColdIQ](https://coldiq.com/tools/creatorco), [GetApp](https://www.getapp.com/marketing-software/a/creator-co/) |
| **Popular Pays (Lightricks)** | SafeCollabs vetting of 160,000+ creators; job posts mention "AI agents" | Not public | Part of Lightricks since 2022 | [S] [MarTech Series](https://martechseries.com/?p=367631) |
| **Archive** | "Archie" sources and vets creators when tagged in Slack or Teams (waitlist). 1,000+ brands; "two of the largest AI labs" run creator programs on it (vendor claim) | Not public | Strategic round 2026-09-02 (Anti Fund, Florida Funders, undisclosed); $30M Series B Feb 2025 [S] | [S] [Contentgrip](https://www.contentgrip.com/archive-creator-marketing-funding/) |
| **Hypefy AI** (Croatia) | Campaign "from a single prompt": "creator discovery and outreach to contracting, content review, reporting, and payments". NIVEA, Unilever, PepsiCo, McDonald's named | Not public | **$7.2M Series A, 2026-07-01** (AYMO Ventures); $1.75M seed 2025 | [V-fetch] [Vestbee](https://www.vestbee.com/insights/articles/hypefy-ai-raises-7-2-m) |
| **Fluencify** (Stockholm) | Finds creators, briefs, schedules, runs paid promotion, pays, across 85+ countries; "Fluencify handles the rest". Vendor claims >$2M ARR in 6 months and about 20,000 active creators | Not public | **$4.3M pre-seed, 2026-09-07** (byFounders, Wave Ventures) | [V-fetch] [Dealroom](https://dealroom.co/news/149130-fluencify-raises-4-3m-pre-seed-to-automate-influencer-marketing-with-ai/) |
| **Stormy AI** (YC) | Agent for discovery, outreach, negotiation | Conflicting: $40 to $350/mo | $2.2M per PitchBook, including a $1.7M round in Apr 2026, unconfirmed | [S] [YC](https://ycombinator.com/companies/stormy-ai), [PitchBook](https://pitchbook.com/profiles/company/640038-34) |
| **Agentio** | AI marketplace buying creator ad reads (YouTube), expanding to Meta partnership ads | Media-buy model | **$40M Series B, 2025-11-18** (Forerunner), $340M valuation, $56M total | [S] [TechCrunch](https://techcrunch.com/2025/11/18/agentio-secures-40-million-from-forerunner-as-it-scales-its-creator-marketplace-beyond-youtube/), [Axios](https://www.axios.com/2025/11/18/agentio-creator-ads-youtube-meta) |

### Inferences
- **Positioning:** "your CRM's Bots hire the creator *and* the editor, inside your deals, with your approval". That is distinct from influencer-team platforms. Magpie's price point (SMB SaaS) undercuts annual-contract tools.
- **Table stakes in 2026:** AI search over a licensed database, auto-drafted outreach, negotiation suggestions, partnership-ad codes, payments. Payments and contracts can follow in v2.
- **Fluencify's ARR claim** shows SMB demand for "done for you" creator campaigns, if true (vendor-claimed).

### Gaps
- No independent data on reply rates or win rates for AI-drafted creator outreach.
- Prices for most incumbents are unpublished.

---

## Recommended v1 sourcing stack (for discussion)

| Layer | v1 choice | Why | Cost (as found 2026-11-10) |
|---|---|---|---|
| Creator discovery + contact data | **Influencers.club API (Pro)**, called server-side behind a `CreatorDataProvider` interface; get **Modash Discovery API** test credits and a HypeAuditor quote to compare email fill-rate | Monthly billing; terms v2.5 explicitly allow customer-facing search and export; validated emails; IG/TikTok/YouTube/X. Modash is the upgrade once volume justifies $16.2K/yr | From $208/mo; about $0.23/credit; 0.2 credits per creator with email (about $0.05) |
| First-party Instagram/Facebook | **Instagram Creator Marketplace API + Facebook Creator Discovery API**, connected per customer via Facebook Login | Free, first-party, creators opted in; returns `email` where available; `exclude_messaged_creators` | $0; needs Meta app review + brand eligibility |
| Vetting / enrichment | YouTube Data API (cache ≤30 days); Instagram Business Discovery for known usernames | Fresh stats, no scraping | $0; 100 searches/day default, so use for lookups, not search |
| TikTok | Vendor data for discovery; **deep-link the customer into TikTok One** to invite; apply to TikTok Marketing Partners (Creator Marketing) for TTO API | No self-serve API | $0 now; partner program has spend and vetting requirements |
| Freelancers (edit/design) | **Upwork** via per-customer OAuth API (job post, invite, offer drafted by Bots, confirmed by customer); **Contra MCP** for commission-free hires; Fiverr MCP search, then link out | Compliant hire paths; draft/confirm models match Magpie's approval gate | Upwork client fees apply; Contra commission-free (vendor) |
| UGC marketplaces | Brief drafted in Magpie, then **hand off** to the customer's Collabstr / JoinBrands / Insense / Billo account; pilot the JoinBrands MCP | No partner APIs | Marketplace fees 8% to 15% |
| Outreach channel | **Email from the customer's own mailbox** (Gmail/Microsoft OAuth) after approval; native-platform messages prepared by Magpie, sent by the customer; **no automated DMs** | Platform rules + deliverability | Included |
| Compliance layer | Source tagging, Art. 14 notice, CAN-SPAM footer, cross-tenant suppression list, per-country rules, CASL evidence log, marketplace-sourced contacts locked to their marketplace | Data vendors push legal duty onto us | Build cost |
| Opt-in talent pool (v1.5) | Creator portal where creators connect accounts (Instagram Login / TikTok Login Kit / Google OAuth, or Phyllo) and set rates | Consent + verified stats; reduces dependence on vendors | Phyllo quote-only; own OAuth $0 |

## Open items to close before build
1. Upwork: have a person read the User Agreement §7, the API Terms of Use and the MCP Beta terms. Confirm that a multi-tenant app may act for many clients, and list the GraphQL mutations for job post, invite and offer. Apply for an API key.
2. Meta: read the Instagram Creator Marketplace Terms of Service (storage, email use, agency/SaaS use). Settle the rate-limit discrepancy (5,000 vs 1,000/user/hour). Start app review.
3. Data vendors: sign test agreements with Influencers.club and Modash. Measure email fill-rate and bounce rate on 500 target creators. Review DPAs. Ask Influencers.club about the "OneMore InfluencersClub OÜ" Schedule M.
4. Counsel: UK/EU position on emailing sole-trader creators with paid-work offers; Art. 14 notice wording; cross-tenant suppression as a joint-processing question.
5. TikTok: contact a TikTok partner manager about the TTO API (discovery + invite) and the Creator Marketing badge criteria.
