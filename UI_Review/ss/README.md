# Screenshot evidence (UI_Review/ss)

This folder is used by **UI_VALIDATOR_PROMPT.md** to store all screenshots captured during the UI/UX compliance audit (Step 5 — Track B).

- **Created by:** The validator creates `UI_Review/ss` at the start of Step 5 if it does not exist.
- **Contents:** PNG files named like `[S##]-[ScreenName]-desktop-default.png`, `-tablet.png`, `-mobile.png`, `-focus-01.png`, etc.
- **Previous runs:** Earlier audit runs saved screenshots to the browser tool’s temp directory; they were not copied here. On the next full run of the UI Validator, new screenshots will be saved (or copied) into this folder per the updated prompt instructions.
