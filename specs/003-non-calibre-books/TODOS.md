Just a place to drop todos as we work through 003

**TODO**
- Ensure that book removal/deletion casecades across all tables
- Determine if we can entirely remove "orphaned" books and or duplicates between local and Calibre/other future book_sources. Do we merge them? Is this a new UI? If they're orphaned from Calibre, we probably just need to remove the `books_sources` entry.
- Integrate provider API/credentials UI into the individual provider items (they're separated in the UI right now and it feels weird)
- Ensure that both Calibre and Local repository flows are not diverging at all
- Troubleshoot why "started date" seems to lag on "reading" status transition for local books, but not seemingly as much for Calibre books. I wonder if there's some weird/unecessary divergent logic here.
- Ensure that local books can transition to each status - thoroughly test this
- Given how the migration strategy refined over time, doublecheck the schema migrations for this shift.
- A deleted book needs to invalidate the book series cache


**DONE**
- Change terminology from "Manual" to "Local". I think this fits better.
- Troubleshoot why a duplicated book's cover doesn't show. See book id 736243
- Upon deleting a book, the /library cache is still not invalidating - the book remains on the /library page upon redirect until your refresh.
- Improve the tag UI for the "Add Book from Search" modal. It should allow users to see existing tags as tag items and remove them with X. But also add others with the search input... I wonder if we could reuse our logic from the "Edit Tags" modal? If we can make that DRY, that'd be awesome!
- Remove the "Calibre" source label from BookCards
- Consolidate the /library filters. E.g., split Sources and Shelves 50/50
- Fix the "All Sources" filter for "Local" in /library - it's not working right now
- Allows covers to be edited in the /books/:id page. This ideally use the same logic/components as the creation modal. We should evaluate if there's any opportunity to unify those forms for DRY-ness.
- Add series and series number (index) to the provider search
- Determine what to do with the Calibre "path" column on the `books` table. My gut says that we should move that into the metadata column for the book_sources table.