# Test business: Mesa Ridge Contracting (a made-up prime contractor)

A small Austin company that wins government service contracts as the prime and hands the work to local subcontractors. It's here to test the company brief, the work plan, the Bot team and "without asking" against real data from Kontract.

**What's real:**
- Open bids, bid documents and past awards come live from Kontract when the Bots look them up.
- The subcontractors under HVAC, plumbing, electrical and roofing come from Austin's public permit data, as pulled by `seed.mjs`. They're real businesses: don't contact them from a test.

**What's sample:**
- Anything named "Sample:": the janitorial and grounds subs, the two customers, and the three past contracts.
- None of it is real past performance, and a proposal must not present it as such.

## Load it

1. In the workspace, create an API key under Settings, API keys.
2. Run:

   ```bash
   KONTRACT_URL=https://kontract-production.up.railway.app KONTRACT_SERVICE_KEY=… \
     node seed.mjs https://<workspace>.up.railway.app mgp_…
   ```

   It refuses to run twice.

## Test it

1. **Today, Tell Magpie about your business, Start.** Answer from the brief below.
2. **Make a plan.** Expect a team such as a Bid desk, a Sub coordinator and a Proposal writer, with jobs like:
   - a Monday bid search;
   - lining up subs for tracked bids;
   - a daily deadline check;
   - a Friday bid review.
3. **Switch one job on.** As an admin, tick one action the Bot may take without asking (for example "Track bid"). Leave the rest asking.
4. **Run it now.** Open the job in Routines and press Run now. The Bot should find real open bids, track them without asking, and ask before anything else.
5. **Check Today.** Last 7 days counts the run, and the Bot's group shows it on the team.

## Answers for the brief interview

- **What we do:** We're the prime on federal and state service contracts in Central Texas: janitorial, grounds and HVAC maintenance. Local subcontractors do the work, and we manage it, pay them net 30 and keep 20 to 30%.
- **Who buys:** Federal agencies (VA, GSA, Interior, Agriculture) and Texas state agencies. Small-business set-asides, $25,000 to $500,000 a year, within 100 miles of Austin.
- **How we win:** Lowest price on services we understand, priced under the last award, with a sub's quote in hand before we bid.
- **Goals for the next 90 days:** submit 3 bids a week, win 2 contracts, and build a bench of 15 vetted subs.
- **How we talk:** Plain and short. Subs are partners: we pay on time and never share our margin.
- **Never:** invent past performance, licenses or certifications; send anything to a contracting officer without approval; show a sub our price or margin.
- **Company details:** UEI TESTUEI00001, CAGE 0TEST, 100 Congress Ave, Austin TX 78701 (all made up). Default markup 30%.
