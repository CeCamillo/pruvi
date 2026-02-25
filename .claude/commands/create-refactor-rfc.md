# Create Refactor RFC

When you identify code that should be refactored but it's not part of your current task:

1. Create a GitHub issue with label `refactor`
2. Title: `refactor: <clear description of what to improve>`
3. Body should include:
   - **Current state:** What exists and why it's problematic
   - **Proposed change:** What the refactored code should look like
   - **Files affected:** List of files that would change
   - **Risk:** Low/Medium/High and why
4. Do NOT implement the refactor — just file the issue
5. Continue with your current task

```bash
gh issue create --title "refactor: <description>" --label "refactor" --body "<body>"
```
