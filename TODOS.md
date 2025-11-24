# Now
* Fix streak tets in CI. They continue to fail. Relative documentation is in /docs: 
    * CI-STREAK-TEST-FAILURE-INVESTIGATION.md
    * PLAN-SKIP-STREAK-TESTS-IN-CI.md
* Add code coverage
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
* Add a UI unit test suite
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
