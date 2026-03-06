### TODOs
- Improve the UI (change colors, disposition of elements, dimension etc. to make it more functional and beautiful) 
- Add any feature that would make the tool accessible for everyone (e.g. add alt text etc.)
- Add some animation while loading: it takes very long before we receive a response from the model (slow API call to HPC4AI servers) but the user does not have any indication that something is happening in the background. We should add some form of animation showing that the process has started and the user should wait for a response
- Store the following events (and others tbd) in MongoDB (NOTE: a session id is already created at the beginning in `initExtension` and should be used in combination with current datetime, to follow the interaction of the user with the tool):
    - in `start_analysis` --> store the option/inclusive strategy that was selected
    - in `content/actions.js` --> the `accept` function should store the single or all accepted text(s) (could be our suggestion or the one written by the user)
    - in `content/actions.js` --> the `discard` function should store the single or all discarded text(s)