# Sprint 3 Retrospective + Sprint 4 Planning

---

# Sprint 3 Retrospective

## What Went Well
- Strong collaboration across team members during testing and code reviews.
- Good progress on CI/CD pipeline and unit test integration.
- Clear distribution of tasks across the team.
- Static analysis tools helped improve code quality.

## What Didn’t Go Well
- Meeting minutes were not well organized or consistent.
- Time tracking lacked detail and clarity.
- Some refactoring introduced risk of breaking changes.
- Error handling in the UI was not user-friendly (inline error messages).

## Improvements for Sprint 4
- Standardize and better organize meeting minutes.
- Add more detailed time logs for tasks.
- Replace inline error message (“meal already added in the same week”) with a toast notification popup.
- Perform refactoring in smaller steps to reduce risk.
- Ensure CI/CD pipeline stability before enforcing strict checks.

---

# Sprint 4 Backlog Overview

| Issue # | User Story Description | Tasks | Story Points (1,2,3,4,5) | Due Date | Priority | Risk | Risk Justification | Assignmed Members |
|----------|------------------------|-------|---------------------------|----------|----------|------|--------------------|--------------------|
| US.23 | As a development team, we want at least 2 acceptance tests per user story so that requirements are validated. | "Task.23.01 Add remaining acceptance tests for Sprint1<br>Task.23.02 Add reamaining acceptance tests for Sprint 2<br>Task.23.03 Add remaining acceptance tests for Sprint 3" | 4 | 4/10/2026 | MEDIUM | LOW | No manipulation of codebase | Becky, Noe, Majd, Justin, Ewan |
| US.24 | As a development team, we want unit tests for all code so that functionality is validated automatically through the CI/CD pipeline. | "Task.24.01 Write unit test for Sprint 3 US 15-17<br>Task.24.02 Write unit test for Sprint 3 US 18-19<br>Task.24.03 Write unit test for Sprint 3 US 20-21<br>Task.24.04 Integrate test into CI/CD pipeline" | 5 | 4/10/2026 | HIGH | MEDIUM | Pipeline misconfiguration or failing tests could block development progress for all members. | Justin, Majd, Luca |
| US.25 | As a developement team, we want to reorganize the projects file structure. | "Task.25.01 Separate test and production code<br>Task.25.02 Organize packages (UI, business, utils)<br>Task.25.03 Refactor structure<br>Task.25.04 Update imports" | 2 | 4/10/2026 | LOW | HIGH | Refactoring structure may introduce breaking changes | Majd, Ewan |
| US.26 | "As a developement team, we want to complete a code review on the new features added from this sprint. " | "Task.26.01 Assign reviewers<br>Task.26.02 Review pull requests<br>Task.26.03 Address comments<br>Task.26.04 Merge approved code" | 3 | 4/10/2026 | MEDIUM | LOW | Functionality should not be modified, only making adjustments to improve code quality. | Luca, Ewan, Justin |
| US.27 | As a developement team, we want to detect and fix 5 bugs using a static analysis tool so that code quality is improved. | "Task.27.01 Configure linter (e.g., ESLint)<br>Task.27.02 Run analysis<br>Task.27.03 Identify 5 issues<br>Task.27.04 Fix bugs<br>Task.27.05 Fixes with references" | 5 | 4/10/2026 | MEDIUM | MEDIUM | Tool setup issues and difficulty reproducing/reporting bugs may slow progress. | Becky, Noe |
| US.28 | As a development team, we want to implement quality of life changes to better enhance the experience of users and improve code quality. | "Task.28.01 Implement quality of life changes<br>Task.28.02 Improve code quality<br>Task.28.03 Add, remove and edit code comments" | 3 | 4/10/2026 | LOW | HIGH | Refactoring/making changes to codebase can introduce new bugs. | Majd, Luca |

**Total Story Points 22**
