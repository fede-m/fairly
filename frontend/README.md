### TODOs
- Improve the UI (change colors, disposition of elements, dimension etc. to make it more functional and beautiful) 
- Add any feature that would make the tool accessible for everyone (e.g. add alt text etc.)
- Add some animation while loading: it takes very long before we receive a response from the model (slow API call to HPC4AI servers) but the user does not have any indication that something is happening in the background. We should add some form of animation showing that the process has started and the user should wait for a response
- Store the following events (and others tbd) in MongoDB (NOTE: a session id is already created at the beginning in `initExtension` and should be used in combination with current datetime, to follow the interaction of the user with the tool):
    - in `start_analysis` --> store the option/inclusive strategy that was selected
    - in `content/actions.js` --> the `accept` function should store the single or all accepted text(s) (could be our suggestion or the one written by the user)
    - in `content/actions.js` --> the `discard` function should store the single or all discarded text(s)


## accessibility

[freecodecamp](https://www.freecodecamp.org/news/how-to-design-accessible-browser-extensions/#:~:text=the%20same%20extension.-,How%20to%20Perform%20Automated%20Browser%20Extension%20Accessibility%20Tests,violations%20and%20implement%20suggested%20fixes)

[WAVE Web Accessibility Evaluation Tools](https://wave.webaim.org/)

manual testing:

- Keyboard Navigation: Ensure you can navigate through the entire extension using only the Tab and Enter/Space keys. Check for a visible focus indicator so users know which element they are currently on.
- Screen Reader Testing: Use a screen reader (like NVDA on Windows or VoiceOver on Mac) to verify that all interactive elements have clear, descriptive labels and that dynamic content updates are announced.
- Zoom and Resizing: Verify that the extension remains functional and readable when the browser or system zoom is set to 200%.
- Color and Contrast: Ensure text has a contrast ratio of at least 4.5:1 against its background. Use the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or built-in DevTools features to verify this.

verify accessibility tree:

1. Right-click an element in your extension and select Inspect.
2. In the Elements panel, look for the Accessibility sub-tab (it may be hidden behind the >> icon).
3. Here you can view the Accessibility Tree, which shows exactly what name, role, and state (e.g., "expanded" or "checked") is being exposed to assistive technologies.

### contrast

text color is rgb(30,31,84) -> #1e1f54
checked pairs: text on all backgrounds. icons
need to be checked:
- list elements with extension background
- extension background with mail white theme
- logo on both white and dark theme