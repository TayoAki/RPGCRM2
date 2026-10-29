# Sample data: a UGC agency

A made-up book of business for a UGC agency: the brands it makes creator content for, the people there, the campaigns it is selling, and the work around them. Use it to demo Magpie or to try features on a workspace with something in it. Every name, email address and phone number is fictional (emails use `.example` domains, which never deliver).

| What | How many |
|---|---|
| Companies (brands) | 14 |
| Contacts | 20, with titles, temperature, tags, email and phone |
| Deals | 16 across every stage: $111,000 open in 12 deals, 3 won, 1 lost |
| Follow-ups | 10: two late, three due today, the rest this week and next |
| Meetings | 5: two later today, three in the next few days |
| Notes | 9 on contacts and deals |
| Tags | 6 |

Dates are set relative to the day you load it, so Today always has something due.

## Option 1: everything, with one command (recommended)

1. In the CRM, open **Settings, API keys** and create a key. Copy it.
2. With Node 18 or newer:

   ```bash
   node seed.mjs https://your-workspace.up.railway.app mgp_your_key
   ```

3. Open Today.

It stops without adding anything if the sample data is already there. Delete the API key afterwards if you don't need it.

## Option 2: CSV files, no command line

`companies.csv`, `contacts.csv` and `deals.csv` use the CRM's own import format. Import them in that order with the **Import CSV** button on Companies, Contacts and Deals. Contacts and deals link to companies by name.

The CSVs leave out follow-ups, meetings and notes, which the import doesn't cover. Their expected close dates are fixed to when the files were written. Run `node seed.mjs --csv` to write them again for today.

## Change it

Edit `data.mjs`: the brands, people, deals, follow-ups and meetings are plain lists, linked by short keys.
