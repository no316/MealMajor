 # February 6, 2026 – Sprint 2: Meeting 1

## Attendance
- Justin Le  
- Ewan St-Louis  
- Majd Tarraf  
- Luca Lapenna  
- Noe Gabriel Menacho Tardieu  
- Becky Zhang  

## Scribe
- Noe Gabriel Menacho Tardieu

---

# Objectives
- Reflect on Sprint 1 performance  
- Identify areas for team improvement  
- Plan Sprint 2 backlog and deliverables  
- Assign tasks and responsibilities  
- Create Sprint 2 GitHub milestone, issues, and task breakdown  

---

# Sprint 1 Retrospective

## What Went Well
- Strong collaboration and communication across the team  
- Effective sprint presentation  
- Tasks were completed within planned deadlines  
- Clear division of responsibilities during implementation  

## Areas for Improvement
- Reduce overlap between user stories to allow more independent work  
- Improve clarity when scoping stories  
- Define responsibilities earlier in the sprint  
- Improve coordination between frontend and backend integration  

---

# Sprint 2 Planning

| Activity | Description | Status |
|-----------|-------------|--------|
| Backlog Finalization | Confirmed Sprint 2 user stories and scope | Completed |
| Task Breakdown | Decomposed user stories into technical tasks | Completed |
| Story Point Estimation | Assigned effort estimates to each story | Completed |
| Task Assignment | Assigned responsibilities to team members | Completed |
| GitHub Milestone | Created Sprint 2 milestone | Completed |
| Issue Creation | Created and linked GitHub issues to user stories | Completed |

---

# Sprint 2 – Backlog Overview

**Sprint Duration:** February 6, 2026 – February 26, 2026  

| Issue | User Story | Tasks | SP | Due Date | Priority | Risk | Risk Justification | Assigned Members |
|--------|------------|--------|----|----------|----------|------|-------------------|------------------|
| **US.07** | Create a recipe so it can be saved and reused later | Create recipe form UI <br> Implement backend API for recipe creation <br> Implement input validation <br> Persist recipe data | 5 | 02/11/2026 | HIGH | MEDIUM | Multiple fields, validation rules, and backend integration introduce risk of invalid or inconsistent data | Becky, Noe |
| **US.08** | View a list of created recipes | Design recipe list UI <br> Implement backend API to fetch recipes <br> Render list on frontend | 3 | 02/12/2026 | MEDIUM | LOW | Read-only functionality with no data modification reduces failure impact | Luca, Justin |
| **US.09** | Edit an existing recipe | Create edit UI with pre-filled data <br> Implement backend update API <br> Validate updated fields | 4 | 02/13/2026 | MEDIUM | MEDIUM | Incorrect validation or ID handling could overwrite the wrong recipe | Justin, Ewan, Majd |
| **US.10** | Delete a recipe | Add delete button to UI <br> Implement backend delete API | 2 | 02/21/2026 | LOW | LOW | Simple delete operation with minimal logic and no sprint-level dependencies | Majd, Luca |
| **US.11** | Search recipes by name | Create search input UI <br> Implement backend search logic <br> Display filtered results | 3 | 02/24/2026 | MEDIUM | MEDIUM | Edge cases such as partial matches, empty results, or invalid queries | Becky, Noe |
| **US.12** | Filter recipes by time or difficulty | Create filter UI controls <br> Implement backend filtering logic <br> Apply filters to recipe list | 4 | 02/26/2026 | MEDIUM | MEDIUM | Combining multiple filters increases logical complexity and risk of incorrect results | Ewan |

---
