Just a place to drop todos as we work through 003

**TODO**
- Improve the tag UI for the "Add Book from Search" modal. It should allow users to see existing tags as tag items and remove them with X. But also add others with the search input... I wonder if we could reuse our logic from the "Edit Tags" modal? If we can make that DRY, that'd be awesome!
- Ensure that book removal/deletion casecades
- Determine if we can entirely remove "orphaned" books. Do we merge them? Is this a new UI? If they're orphaned from Calibre, we probably just need to remove the `books_sources` entry.
- Integrate provider API/credentials UI into the individual provider items (they're separated in the UI right now and it feels weird)
- Ensure that both Calibre and Manual repository flows are not diverging at all
- Change terminology from "Manual" to "Local". I think this fits better.

**DOING**

**DONE**
- Fix the "All Sources" filter for "Manual" in /library - it's not working right now
- Consolidate the /library filters. E.g., split Sources and Shelves 50/50
- Allows covers to be edited in the /books/:id page. This ideally use the same logic/components as the creation modal. We should evaluate if there's any opportunity to unify those forms for DRY-ness.
- Add series and series number (index) to the provider search
- Determine what to do with the Calibre "path" column on the `books` table. My gut says that we should move that into the metadata column for the book_sources table.