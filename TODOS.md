# Now
* Ability to edit an existing review on the /books/:id page
    * I also think there's a bug with the calibre write.
* Breakdown the monolith that is /books/:id, both frontend and backend
    * Right now, /books/:id does a lot and it's self-contained not all that well tested:
        * Displays books
        * Logs and renders progress
        * Transitions reading session statuses
        * Set pages, which is essential for our progress tracking
    * Just like we did with /library, we should break the frontend down into more modular React components and add a service layer to the backend interacts with the API
    * That will allow us to heavily test the service layer
    * Write unit and integration tests for the service layer
    * Write individual ADRs about these architectural pattern: frontend components separation and backend service layer
* Add code coverage
* Evaluate DB migrations
    * Auto DB backup before migration
* Annual goals
    * A user can establish annual reading goals, just like in Goodreads and The Story Graph.
    * The user can set a goal for the number of books that they want to read in a year
    * The user can see their current progress against there goal and if they're on track, either ahead or behind by a specific number of books
    * They should be able to see their goal progress on the dashboard or / page
    * In the library view, they can filter "read" books by the year that they've read them - reading_sessions
* Reading Streak
    * Shift primarily to stats page
    * Dashboard: consolidate the reading streak UI component, similar to TSG
    * GitHub style activity chart
    * "Journal" page
        * Similar to Thoreau's design
        * Reusable component for the /book/:id page
* View "Orphaned" books and add instructions for "how to repair"
* Book series support from Calibre


# Next
* Edit previous reviews
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
* Library view allows "multi-select" style management
    * This allows you to select several books at once and change particular aspects about them, such as their status
    * Will need to identify which values are editable in this view

# Later
* Import from Goodreads or TheStoryGraph
* Data export
* (Big question) Audiobook support?
    * May require custom records - protect from calibre cleanup