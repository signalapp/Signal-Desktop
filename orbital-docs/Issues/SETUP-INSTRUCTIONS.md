# GitHub Project Setup Instructions

Quick guide to set up GitHub Issues and Project Board for Orbital development.

---

## Step 1: Create Labels

Go to: **Settings → Labels** and create these labels:

### Phase Labels
```
phase-1     #0E8A16  Week 1: Signal Foundation
phase-2     #1D76DB  Week 2: Media Integration
phase-3     #5319E7  Week 2: Groups & Deploy
phase-4     #D93F0B  Week 3: Beta Testing
```

### Type Labels
```
setup           #C5DEF5  Initial configuration
backend         #0052CC  Node.js/API work
frontend        #006B75  React/UI work
database        #B60205  PostgreSQL/schema
infrastructure  #5319E7  Deployment/DevOps
security        #D93F0B  Security audit/testing
testing         #FBCA04  Testing/QA
bug             #D73A4A  Bug fixes
documentation   #0075CA  Documentation
performance     #BFD4F2  Optimization
```

### Priority Labels
```
critical    #B60205  Must fix immediately
high        #D93F0B  Fix within 1-2 days
medium      #FBCA04  Fix if time allows
low         #C5DEF5  Defer to post-MVP
```

### Special Labels
```
milestone       #5319E7  Milestone tracking
dependencies    #FBCA04  Has dependencies
blocked         #D73A4A  Blocked by something
```

---

## Step 2: Create Milestones

Go to: **Issues → Milestones** and create:

### Milestone 1: Signal Foundation (Days 1-7)
- **Due Date:** 2025-11-12 (adjust based on start date)
- **Description:** Fork Signal-Desktop, extract core modules, build threading layer

### Milestone 2: Media Integration (Days 8-11)
- **Due Date:** 2025-11-15
- **Description:** Implement 7-day media relay with Signal encryption and storage quotas

### Milestone 3: Groups & Polish (Days 12-14)
- **Due Date:** 2025-11-19
- **Description:** Group management, invite codes, security audit, deployment

### Milestone 4: Beta Testing & Iteration (Days 15-21)
- **Due Date:** 2025-11-26
- **Description:** Beta testing with real families, bug fixes, performance tuning

---

## Step 3: Create Issues

**Option A: Manual Creation**

Go to **Issues → New Issue** and copy content from [ISSUES.md](ISSUES.md):

1. Copy issue title (e.g., "Fork and Setup Signal-Desktop Repository")
2. Copy issue body (everything under the title)
3. Assign appropriate labels
4. Assign to milestone
5. Estimate time (use description in issue)

**Option B: Automated Creation (if you have `gh` CLI)**

```bash
# Install GitHub CLI
brew install gh  # macOS
# or: https://cli.github.com/

# Login
gh auth login

# Create issues from template (you'd need to script this)
# Example for one issue:
gh issue create \
  --title "Fork and Setup Signal-Desktop Repository" \
  --body-file .github/issues/issue-01.md \
  --label "setup,phase-1,dependencies" \
  --milestone "Signal Foundation (Days 1-7)"
```

**Option C: Import from Template Repository**

If you have a template repository with these issues, you can use:
- GitHub's "Generate from template" feature
- Or bulk import tools like https://github.com/jsmrcaga/github-import

---

## Step 4: Create Project Board (Optional but Recommended)

Go to: **Projects → New Project → Board**

### Project: "Orbital MVP Development"

**Columns:**
1. **Backlog** - Not started, not assigned
2. **To Do** - Ready to start, assigned
3. **In Progress** - Currently being worked on
4. **In Review** - PR open, needs review
5. **Done** - Completed and merged

**Automation:**
- Auto-move to "In Progress" when issue assigned
- Auto-move to "In Review" when PR linked
- Auto-move to "Done" when issue closed

**Views:**
- **By Milestone:** Group by milestone to see phase progress
- **By Assignee:** See what each person is working on
- **By Label:** Filter by backend/frontend/etc.

---

## Step 5: Issue Management Best Practices

### Starting Work
1. Move issue to "In Progress"
2. Assign yourself
3. Create feature branch: `feature/issue-XX-short-description`
4. Reference issue in commits: `git commit -m "feat: implement X (#XX)"`

### Completing Work
1. Create PR with `Closes #XX` in description
2. Request review
3. Merge when approved
4. Issue auto-closes and moves to "Done"

### Dependencies
- If issue depends on another, add comment: "Blocked by #XX"
- Use "blocked" label
- Don't start until dependency resolved

### Bug Triage (during Beta)
1. Create issue with `bug` label
2. Add priority label (critical/high/medium/low)
3. Assign milestone if fixing in MVP, otherwise defer
4. Critical bugs: fix immediately, high bugs: fix within 1-2 days

---

## Step 6: Tracking Progress

### Daily Standups (Optional but Helpful)
- What did you complete yesterday?
- What are you working on today?
- Any blockers?

### Weekly Reviews
- Review milestone progress
- Adjust timeline if needed
- Reprioritize issues

### Metrics to Track
- **Velocity:** Issues completed per week
- **Burndown:** Issues remaining vs timeline
- **Blockers:** How many issues are blocked?

---

## Quick Commands (GitHub CLI)

```bash
# View all issues
gh issue list

# View issues in a milestone
gh issue list --milestone "Signal Foundation (Days 1-7)"

# View your assigned issues
gh issue list --assignee @me

# View issues with specific label
gh issue list --label "phase-1"

# Create new issue
gh issue create

# Close issue
gh issue close 123

# View issue details
gh issue view 123
```

---

## Timeline Summary

**Start Date:** 2025-11-05 (adjust as needed)

| Week | Milestone | Issues | Deadline |
|------|-----------|--------|----------|
| Week 1 | Signal Foundation | #1-7 | 2025-11-12 |
| Week 2 (Days 8-11) | Media Integration | #8-11 | 2025-11-15 |
| Week 2 (Days 12-14) | Groups & Polish | #12-15 | 2025-11-19 |
| Week 3 | Beta Testing | #16-20 | 2025-11-26 |

**MVP Launch:** 2025-11-26 (21 days total)

---

## Next Steps After Setup

1. ✅ Create all labels
2. ✅ Create all milestones
3. ✅ Create all 20 issues
4. ✅ Create project board
5. ⏭️ Start with Issue #1: Fork Signal-Desktop

---

## Support

- **Issues template:** See [ISSUES.md](ISSUES.md)
- **Architecture docs:** See [project-docs/](../project-docs/)
- **Questions:** Create a discussion in GitHub Discussions

---

**Good luck! 🚀**
