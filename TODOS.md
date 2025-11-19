# Now
* Finish book and update rating
    * Remove rating from ReadingSession model - this should live on the book model, as it is stored in Calibre
        However, maintaining, "Review", makes a lot of sense. Albeit, we'll need to add a UI element to log a review.
    * Sets the rating value in Calibre DB (update) - add test coverage
    * Modal-like experience, allowing you to set the review and rating.
    * UI confetti on modal confirmation
    * Filter by rating in library page
    * Sort in library
* Critical architectural review
* Annual goals
* Reading Streak
    * Shift primarily to stats page
    * Dashboard: consolidate the reading streak UI component, similar to TSG
    * GitHub style activity chart
    * "Journal" page
        * Similar to Thoreau's design
        * Reusable component for the /book/:id page
* Replace BookCard status colors with icons from library and /book/:id pages
* Re-architect agent documentation to support claude, copilot, and openagent
* View "Orphaned" books and add instructions for "how to repair"
* Remove stats from the dashboard - UI and data

# Next
* Library search supports book description
    * Right now, it only supports title
* Add a UI unit test suite
* If filtering on "Read", allow year filtering
* Integrate Pino logger
    * File logging
    * Trace log calibre syncs
* Add logo to navigation and favicon
* Harder push to Thoreau UI/UX design
* Allow log progress on dashboard
    * Reuse component on book/:id page

# Later
* Import from Goodreads or TheStoryGraph
* Data export
* Audiobook support?
    * May require custom records - protect from calibre cleanup