// A UGC agency's book of business: the brands it makes creator content for, the people there,
// the campaigns it's selling, and the follow-ups and meetings that keep them moving.
// Every name, email and phone number is made up. Day offsets are relative to the day you seed.

export const TAGS = [
  { key: "beauty", name: "Beauty", color: "#eddcd2" },
  { key: "food", name: "Food & drink", color: "#fff1e6" },
  { key: "fitness", name: "Fitness", color: "#d4e4d6" },
  { key: "tech", name: "Tech & apps", color: "#dbe7f0" },
  { key: "repeat", name: "Repeat client", color: "#e2ece9" },
  { key: "decision", name: "Decision maker", color: "#f0e6ef" },
];

export const COMPANIES = [
  { key: "glowbird", name: "Glowbird Skincare", sector: "consumer-staples", size: 50, website: "https://glowbird.example", city: "Los Angeles", state_abbr: "CA", country: "USA", description: "Clean skincare sold DTC and on Amazon. Runs most of its paid social on creator video.", revenue: "12M", lifecycle_stage: "client", lead_source: "Referral" },
  { key: "peak", name: "Peak Pantry", sector: "consumer-staples", size: 50, website: "https://peakpantry.example", city: "Denver", state_abbr: "CO", country: "USA", description: "High-protein snacks. Big Amazon business, wants better listing videos.", revenue: "8M", lifecycle_stage: "prospect", lead_source: "Website" },
  { key: "loop", name: "Loop Athletics", sector: "consumer-discretionary", size: 250, website: "https://loopathletics.example", city: "Austin", state_abbr: "TX", country: "USA", description: "Activewear brand launching a spring line. Testing TikTok Shop.", revenue: "40M", lifecycle_stage: "prospect", lead_source: "Cold outreach" },
  { key: "fernway", name: "Fernway Pet Co.", sector: "consumer-staples", size: 10, website: "https://fernway.example", city: "Portland", state_abbr: "OR", country: "USA", description: "Pet supplements on subscription. Monthly UGC retainer since spring.", revenue: "3M", lifecycle_stage: "client", lead_source: "Referral" },
  { key: "brightside", name: "Brightside Coffee", sector: "consumer-staples", size: 10, website: "https://brightside.example", city: "Seattle", state_abbr: "WA", country: "USA", description: "Coffee subscription. Wants an unboxing series for the holidays.", revenue: "2M", lifecycle_stage: "prospect", lead_source: "Event" },
  { key: "nimbus", name: "Nimbus Audio", sector: "information-technology", size: 50, website: "https://nimbusaudio.example", city: "San Francisco", state_abbr: "CA", country: "USA", description: "Wireless earbuds. Needs product demo reels for Meta and YouTube Shorts.", revenue: "15M", lifecycle_stage: "prospect", lead_source: "Website" },
  { key: "tidal", name: "Tidal Hydration", sector: "consumer-staples", size: 10, website: "https://tidalhydration.example", city: "Miami", state_abbr: "FL", country: "USA", description: "Electrolyte drink mix. Sponsors gym creators.", revenue: "5M", lifecycle_stage: "lead", lead_source: "Cold outreach" },
  { key: "oakhaven", name: "Oakhaven Home", sector: "consumer-discretionary", size: 10, website: "https://oakhaven.example", city: "Nashville", state_abbr: "TN", country: "USA", description: "Candles and home fragrance. Bought a holiday gifting pack.", revenue: "4M", lifecycle_stage: "client", lead_source: "Referral" },
  { key: "sprout", name: "Sprout Kids", sector: "consumer-discretionary", size: 50, website: "https://sproutkids.example", city: "Chicago", state_abbr: "IL", country: "USA", description: "Kids clothing. Chose an in-house team for back to school.", revenue: "9M", lifecycle_stage: "former-client", lead_source: "Website" },
  { key: "velvet", name: "Velvet & Vine", sector: "consumer-staples", size: 10, website: "https://velvetvine.example", city: "Napa", state_abbr: "CA", country: "USA", description: "Wine club. Paused marketing spend until January.", revenue: "6M", lifecycle_stage: "prospect", lead_source: "Event" },
  { key: "northstar", name: "Northstar Travel Gear", sector: "consumer-discretionary", size: 50, website: "https://northstartravel.example", city: "Boston", state_abbr: "MA", country: "USA", description: "Carry-on luggage. Wants a travel creator series before summer.", revenue: "20M", lifecycle_stage: "prospect", lead_source: "Cold outreach" },
  { key: "pixel", name: "Pixel Pals Games", sector: "communication-services", size: 50, website: "https://pixelpals.example", city: "Los Angeles", state_abbr: "CA", country: "USA", description: "Mobile game. Buys app install ads at volume and needs many hooks.", revenue: "25M", lifecycle_stage: "lead", lead_source: "Website" },
  { key: "calmly", name: "Calmly", sector: "health-care", size: 50, website: "https://calmly.example", city: "New York", state_abbr: "NY", country: "USA", description: "Meditation app. Wants testimonial-style UGC for Meta ads.", revenue: "18M", lifecycle_stage: "prospect", lead_source: "Referral" },
  { key: "hearth", name: "Hearth & Hone", sector: "consumer-discretionary", size: 10, website: "https://hearthhone.example", city: "Minneapolis", state_abbr: "MN", country: "USA", description: "Cookware. Wants recipe videos from home cooks.", revenue: "7M", lifecycle_stage: "lead", lead_source: "Website" },
];

// status: cold, warm, hot or in-contract. lifecycle_stage: lead, prospect, client or former-client.
export const CONTACTS = [
  { key: "maya", company: "glowbird", first_name: "Maya", last_name: "Chen", title: "Head of Growth", status: "in-contract", lifecycle_stage: "client", tags: ["beauty", "repeat", "decision"], background: "Owns the paid social budget. Prefers hooks in the first two seconds and loves before and after formats." },
  { key: "jordan", company: "glowbird", first_name: "Jordan", last_name: "Price", title: "Paid Social Manager", status: "hot", lifecycle_stage: "client", tags: ["beauty", "repeat"], background: "Runs the ad account day to day. Sends performance data every Friday." },
  { key: "sam", company: "peak", first_name: "Sam", last_name: "Okafor", title: "Amazon Marketing Lead", status: "warm", lifecycle_stage: "prospect", tags: ["food", "decision"], background: "Wants listing videos that show the texture of the bars up close." },
  { key: "lena", company: "peak", first_name: "Lena", last_name: "Brooks", title: "Brand Manager", status: "warm", lifecycle_stage: "prospect", tags: ["food"] },
  { key: "diego", company: "loop", first_name: "Diego", last_name: "Alvarez", title: "VP Marketing", status: "warm", lifecycle_stage: "prospect", tags: ["fitness", "decision"], background: "Met at a DTC dinner. Launching a spring line in March and testing TikTok Shop." },
  { key: "priya", company: "loop", first_name: "Priya", last_name: "Nair", title: "Influencer Marketing Manager", status: "hot", lifecycle_stage: "prospect", tags: ["fitness"] },
  { key: "tom", company: "fernway", first_name: "Tom", last_name: "Becker", title: "Founder", status: "in-contract", lifecycle_stage: "client", tags: ["repeat", "decision"], background: "Founder-led brand. Approves every video himself, usually within a day." },
  { key: "ava", company: "brightside", first_name: "Ava", last_name: "Martin", title: "Marketing Director", status: "hot", lifecycle_stage: "prospect", tags: ["food", "decision"] },
  { key: "kenji", company: "nimbus", first_name: "Kenji", last_name: "Watanabe", title: "Head of Performance", status: "hot", lifecycle_stage: "prospect", tags: ["tech", "decision"], background: "Data driven. Will judge the pilot on cost per purchase against their studio ads." },
  { key: "grace", company: "nimbus", first_name: "Grace", last_name: "Lee", title: "Creative Strategist", status: "warm", lifecycle_stage: "prospect", tags: ["tech"] },
  { key: "marcus", company: "tidal", first_name: "Marcus", last_name: "Johnson", title: "Co-founder", status: "cold", lifecycle_stage: "lead", tags: ["fitness", "decision"] },
  { key: "olivia", company: "oakhaven", first_name: "Olivia", last_name: "Hart", title: "E-commerce Manager", status: "in-contract", lifecycle_stage: "client", tags: ["repeat"] },
  { key: "ben", company: "sprout", first_name: "Ben", last_name: "Carter", title: "Brand Director", status: "cold", lifecycle_stage: "former-client", tags: [] },
  { key: "sofia", company: "velvet", first_name: "Sofia", last_name: "Rossi", title: "Head of Membership", status: "warm", lifecycle_stage: "prospect", tags: ["food", "decision"] },
  { key: "ethan", company: "northstar", first_name: "Ethan", last_name: "Walsh", title: "Director of Brand", status: "hot", lifecycle_stage: "prospect", tags: ["decision"], background: "Wants creators who actually travel, not studio shots. Budget is set for Q1." },
  { key: "zoe", company: "northstar", first_name: "Zoe", last_name: "Kim", title: "Social Media Lead", status: "warm", lifecycle_stage: "prospect", tags: [] },
  { key: "liam", company: "pixel", first_name: "Liam", last_name: "Novak", title: "User Acquisition Lead", status: "warm", lifecycle_stage: "lead", tags: ["tech", "decision"], background: "Tests 30 to 50 new hooks a month. Cares about volume and turnaround." },
  { key: "hana", company: "calmly", first_name: "Hana", last_name: "Sato", title: "Growth Marketing Manager", status: "hot", lifecycle_stage: "prospect", tags: ["tech", "decision"] },
  { key: "noah", company: "hearth", first_name: "Noah", last_name: "Fischer", title: "Founder", status: "warm", lifecycle_stage: "lead", tags: ["food", "decision"] },
  { key: "emma", company: "hearth", first_name: "Emma", last_name: "Reyes", title: "Content Manager", status: "cold", lifecycle_stage: "lead", tags: ["food"] },
];

// stage: opportunity, proposal-sent, in-negociation, won, lost or delayed (the CRM's default stages).
// createdDaysAgo spreads deals over the last few months; closesInDays is the expected close date.
export const DEALS = [
  { key: "glow-holiday", company: "glowbird", contacts: ["maya", "jordan"], name: "Holiday UGC bundle: 12 TikTok videos", stage: "proposal-sent", amount: 9600, createdDaysAgo: 9, closesInDays: 10, description: "Twelve 30-second videos, three creators, two rounds of edits." },
  { key: "glow-whitelist", company: "glowbird", contacts: ["maya"], name: "Whitelisting rights, 90 days", stage: "won", amount: 3000, createdDaysAgo: 40, closesInDays: -30, description: "Run ads from creator handles for 90 days." },
  { key: "peak-amazon", company: "peak", contacts: ["sam"], name: "Amazon listing videos (6)", stage: "in-negociation", amount: 4200, createdDaysAgo: 18, closesInDays: 7, description: "Six product videos for the main listings, texture close-ups." },
  { key: "peak-retainer", company: "peak", contacts: ["sam", "lena"], name: "Q1 monthly UGC retainer", stage: "opportunity", amount: 4500, createdDaysAgo: 3, closesInDays: 45 },
  { key: "loop-spring", company: "loop", contacts: ["diego", "priya"], name: "Spring launch: 20 creator videos", stage: "opportunity", amount: 18000, createdDaysAgo: 6, closesInDays: 60, description: "Twenty videos across five creators for the March launch and TikTok Shop." },
  { key: "fernway-retainer", company: "fernway", contacts: ["tom"], name: "Monthly UGC retainer", stage: "won", amount: 5500, createdDaysAgo: 150, closesInDays: -120, description: "Eight videos a month, renewed every quarter." },
  { key: "brightside-unboxing", company: "brightside", contacts: ["ava"], name: "Subscription unboxing series", stage: "proposal-sent", amount: 7200, createdDaysAgo: 12, closesInDays: 14 },
  { key: "nimbus-demo", company: "nimbus", contacts: ["kenji", "grace"], name: "Product demo reels (10)", stage: "in-negociation", amount: 11500, createdDaysAgo: 25, closesInDays: 5, description: "Ten demo reels for Meta and YouTube Shorts, plus raw footage." },
  { key: "tidal-summer", company: "tidal", contacts: ["marcus"], name: "Summer gym creators campaign", stage: "opportunity", amount: 14000, createdDaysAgo: 2, closesInDays: 90 },
  { key: "oakhaven-holiday", company: "oakhaven", contacts: ["olivia"], name: "Holiday gifting UGC (8 videos)", stage: "won", amount: 6400, createdDaysAgo: 35, closesInDays: -12 },
  { key: "sprout-bts", company: "sprout", contacts: ["ben"], name: "Back-to-school photo and video pack", stage: "lost", amount: 3800, createdDaysAgo: 95, closesInDays: -60, description: "Lost to an in-house team." },
  { key: "velvet-tasting", company: "velvet", contacts: ["sofia"], name: "Creator tasting videos", stage: "delayed", amount: 5000, createdDaysAgo: 50, closesInDays: 75, description: "Paused until their January budget." },
  { key: "northstar-travel", company: "northstar", contacts: ["ethan", "zoe"], name: "Travel creator series (15)", stage: "proposal-sent", amount: 13500, createdDaysAgo: 15, closesInDays: 21 },
  { key: "pixel-hooks", company: "pixel", contacts: ["liam"], name: "App install ads: 25 hooks", stage: "opportunity", amount: 9000, createdDaysAgo: 4, closesInDays: 30 },
  { key: "calmly-testimonials", company: "calmly", contacts: ["hana"], name: "Testimonial UGC for Meta ads", stage: "in-negociation", amount: 6000, createdDaysAgo: 20, closesInDays: 9 },
  { key: "hearth-recipes", company: "hearth", contacts: ["noah", "emma"], name: "Recipe creator videos (10)", stage: "opportunity", amount: 8500, createdDaysAgo: 8, closesInDays: 40 },
];

// Follow-ups: dueInDays below 0 is late, 0 is due today. type is one of the CRM's task types.
export const FOLLOW_UPS = [
  { contact: "sam", type: "follow-up", text: "Send revised quote for the six Amazon videos", dueInDays: -2 },
  { contact: "kenji", type: "email", text: "Send Nimbus the pilot results from the two test reels", dueInDays: -1 },
  { contact: "maya", type: "call", text: "Walk Maya through the holiday bundle proposal", dueInDays: 0 },
  { contact: "ava", type: "follow-up", text: "Check Brightside has the unboxing proposal and answer questions", dueInDays: 0 },
  { contact: "hana", type: "email", text: "Send Calmly three creator profiles for testimonials", dueInDays: 0 },
  { contact: "ethan", type: "demo", text: "Show Northstar the travel creator shortlist", dueInDays: 2 },
  { contact: "diego", type: "meeting", text: "Book the spring launch kickoff with Loop", dueInDays: 3 },
  { contact: "liam", type: "email", text: "Send Pixel Pals 10 sample hooks", dueInDays: 5 },
  { contact: "tom", type: "thank-you", text: "Thank Tom for renewing the retainer", dueInDays: 7 },
  { contact: "marcus", type: "call", text: "Intro call with Tidal about the summer campaign", dueInDays: 10 },
];

// Meetings: startsInHours is from the moment you seed, so the first two land later today.
export const MEETINGS = [
  { title: "Nimbus pilot review", contact: "kenji", deal: "nimbus-demo", startsInHours: 2, minutes: 30, location: "Google Meet" },
  { title: "Glowbird holiday bundle walkthrough", contact: "maya", deal: "glow-holiday", startsInHours: 4, minutes: 45, location: "Zoom" },
  { title: "Northstar creator shortlist", contact: "ethan", deal: "northstar-travel", startsInHours: 26, minutes: 30, location: "Zoom" },
  { title: "Calmly testimonial brief", contact: "hana", deal: "calmly-testimonials", startsInHours: 50, minutes: 30, location: "Google Meet" },
  { title: "Loop spring launch kickoff", contact: "diego", deal: "loop-spring", startsInHours: 75, minutes: 60, location: "Loop HQ, Austin" },
];

// status on a contact note sets the contact's temperature, as in the CRM.
export const CONTACT_NOTES = [
  { contact: "maya", status: "hot", daysAgo: 1, text: "Maya liked the holiday concepts. Wants two of the twelve videos in Spanish. Budget approved, waiting on legal for usage terms." },
  { contact: "kenji", status: "hot", daysAgo: 3, text: "The two test reels beat their studio ads on cost per purchase by about 30%. Kenji wants to scale to ten if pricing works." },
  { contact: "sam", status: "warm", daysAgo: 4, text: "Sam pushed back on price. Offered to drop raw footage to bring it under $4,000." },
  { contact: "diego", status: "warm", daysAgo: 6, text: "Intro call with Diego. Spring line launches in March. They want 20 videos across 5 creators, plus TikTok Shop rights." },
  { contact: "ben", status: "cold", daysAgo: 60, text: "Sprout chose an in-house team for back to school. Check back before summer." },
  { contact: "tom", status: "in-contract", daysAgo: 2, text: "Monthly review went well. Renewing for another quarter." },
];

export const DEAL_NOTES = [
  { deal: "glow-holiday", daysAgo: 1, text: "Proposal sent: $9,600 for 12 videos, three creators, two rounds of edits. Spanish versions quoted separately." },
  { deal: "nimbus-demo", daysAgo: 3, text: "Pilot numbers are strong. Negotiating usage rights length: they want 12 months, we quoted 6." },
  { deal: "velvet-tasting", daysAgo: 20, text: "Sofia paused all paid social until January. Keep warm with a holiday card." },
];
