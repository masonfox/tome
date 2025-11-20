# Now
* Finish book and update rating
    * Remove rating from ReadingSession model - this should live on the book model, as it is stored in Calibre
        However, maintaining, "Review", makes a lot of sense. Albeit, we'll need to add a UI element to log a review.
    * Sets the rating value in Calibre DB (update) - add test coverage
        * The docs will need to be updated to reflect this
        * It otherwise states that the calibre db is read only
        * Adjust it and limit to only KNOWN cases, this rating case being one of the only "approved" cases
    * Modal-like experience, allowing you to set the review and rating.
    * Filter by rating in library page
        * This will require filtering the UI/UX
    * Enable sort by rating in the library page
* Critical architectural review
* Annual goals
* Reading Streak
    * Shift primarily to stats page
    * Dashboard: consolidate the reading streak UI component, similar to TSG
    * GitHub style activity chart
    * "Journal" page
        * Similar to Thoreau's design
        * Reusable component for the /book/:id page
* Re-architect agent documentation to support claude, copilot, and openagent
    * Explicitly request that it always evaluate, edit, or expand the test suite where it's related.
* View "Orphaned" books and add instructions for "how to repair"
* If filtering on "Read", allow year filtering
* Series support


# Next
* Library search supports book description
    * Right now, it only supports title
* Add a UI unit test suite
* Integrate Pino logger
    * File logging
    * Trace log calibre syncs
* Add logo to navigation and favicon
* Allow log progress on dashboard
    * Reuse component on book/:id page
* Restyle toasts


# Later
* Import from Goodreads or TheStoryGraph
* Data export
* (Big question) Audiobook support?
    * May require custom records - protect from calibre cleanup