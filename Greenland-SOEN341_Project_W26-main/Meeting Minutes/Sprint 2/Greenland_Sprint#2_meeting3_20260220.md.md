# February 20, 2026 – Sprint 2: Meeting 3

## Attendance
- Justin Le  
- Ewan St-Louis  
- Majd Tarraf  
- Luca Lapenna  
- Noe Gabriel Menacho Tardieu  
- Becky Zhang  

## Scribe
- Becky Zhang  

---

# Objectives
- Review CI/CD pipeline creation and validation  
- Review progress on Sprint 2 development tasks  
- Confirm automated acceptance test coverage  
- Add project management visualization story (Gantt chart)  
- Verify workload distribution and timeline alignment  

---

# Sprint Progress Review

- Reviewed progress on US.07 – US.13  
- Confirmed majority of Sprint 2 features are implemented  
- Verified acceptance criteria for completed stories  
- Identified minor integration issues and resolved blockers  
- Confirmed all Sprint 2 functionalities remain within sprint scope  

---

# CI/CD Pipeline Review (US.13 – Automated Testing & CI Pipeline)

- Demonstrated successful CI workflow execution on push and pull request  
- Confirmed automated acceptance tests execute in pipeline  
- Verified merge blocking on failed test cases  
- Reviewed pipeline configuration for maintainability  
- Confirmed environment setup consistency across development team  
- Agreed to continue monitoring pipeline stability  

### Acceptance Tests Integrated

#### AT.02.1 – Login Validation & Authentication Flow

**Scenario 1 – Empty Submission**
- User submits login form without credentials  
- System displays validation error messages  

**Scenario 2 – Invalid Credentials**
- User enters invalid credentials  
- System returns 401 (Unauthorized)  
- Authentication error message is displayed  

**Scenario 3 – Valid Credentials**
- User enters valid credentials  
- System returns 200 (OK)  
- User is redirected to Profile page  
- User session is stored  

---

#### AT.18.1 – Save and Persist Diet Preference

**Scenario – Save Preference**
- User logs in successfully  
- Navigates to Profile → Diet Preferences tab  
- Selects diet preference (e.g., Vegan)  
- Clicks “Save Preference”  
- System displays confirmation message  
- Preference is stored in database  

**Persistence Validation**
- User refreshes page or logs out and logs back in  
- Previously saved diet preference remains selected  

---

# Backlog Update – Added New Story

## US.14 – Sprint Timeline Visualization (Gantt Chart)

**User Story:**  
As a development team, we want to create a Gantt chart that displays the tasks completed by each team member by week for the first two sprints.

**Tasks:**
- Task.14.1 Create Gantt chart  

**Story Points:** 1  
**Due Date:** 02/27/2026  
**Priority:** LOW  
**Risk:** LOW  
**Risk Justification:** Does not interact with or manipulate the codebase.  
**Assigned Member:** Justin  

---

# Time Log Summary
# Sprint 2 – Project Distribution

## User Story Allocation & Workload Breakdown

| Issue # | User Story Description | Story Points | Due Date | Priority | Risk | Assigned Members |
|----------|-------------------------|--------------|-----------|-----------|--------|-------------------|
| US.07 | Create a recipe by entering its details | 5 | 02/25/2026 | HIGH | MEDIUM | Becky, Noe |
| US.08 | View a list of created recipes | 3 | 02/25/2026 | MEDIUM | LOW | Luca, Justin |
| US.09 | Edit an existing recipe | 4 | 02/25/2026 | MEDIUM | MEDIUM | Justin, Majd |
| US.10 | Delete a recipe | 2 | 02/25/2026 | LOW | LOW | Majd, Luca |
| US.11 | Search for recipes by name | 4 | 02/26/2026 | MEDIUM | MEDIUM | Becky, Noe |
| US.12 | Filter recipes by time or difficulty | 4 | 02/26/2026 | MEDIUM | MEDIUM | Ewan, Majd |

---

## Detailed Task Breakdown

### US.07 – Create Recipe (5 SP)
**Assigned:** Becky, Noe  
**Risk:** MEDIUM  
**Risk Justification:** Multiple fields, validation rules, and backend integration introduce risk of invalid input or inconsistent data.

Tasks:
- Task.07.01 Create recipe form UI  
- Task.07.02 Implement backend API for recipe creation  
- Task.07.03 Implement recipe input validation  
- Task.07.04 Persist recipe data to storage  

---

### US.08 – View Recipes (3 SP)
**Assigned:** Luca, Justin  
**Risk:** LOW  
**Risk Justification:** Read-only functionality with no data modification reduces failure impact.

Tasks:
- Task.08.01 Design recipe list UI  
- Task.08.02 Implement backend API to fetch recipes  
- Task.08.03 Render recipe list on frontend  

---

### US.09 – Edit Recipe (4 SP)
**Assigned:** Justin, Majd  
**Risk:** MEDIUM  
**Risk Justification:** Incorrect validation or ID handling could overwrite the wrong recipe.

Tasks:
- Task.09.01 Create edit-recipe UI with pre-filled data  
- Task.09.02 Implement backend API to update recipe  
- Task.09.03 Validate updated recipe fields  

---

### US.10 – Delete Recipe (2 SP)
**Assigned:** Majd, Luca  
**Risk:** LOW  
**Risk Justification:** Simple delete operation with limited logic and no sprint-level dependencies.

Tasks:
- Task.10.01 Add delete button to recipe UI  
- Task.10.02 Implement backend API to delete recipe  

---

### US.11 – Search Recipes (4 SP)
**Assigned:** Becky, Noe  
**Risk:** MEDIUM  
**Risk Justification:** Edge cases such as partial matches, empty results, or invalid queries.

Tasks:
- Task.11.01 Create search input UI  
- Task.11.02 Implement backend search logic  
- Task.11.03 Display filtered search results  

---

### US.12 – Filter Recipes (4 SP)
**Assigned:** Ewan, Majd  
**Risk:** MEDIUM  
**Risk Justification:** Combining multiple filters increases logical complexity and risk of incorrect results.

Tasks:
- Task.12.01 Create filter UI controls  
- Task.12.02 Implement backend filtering logic  
- Task.12.03 Apply filters to recipe list  

---

## Workload Balance Summary

- **Becky:** US.07, US.11  
- **Noe:** US.07, US.11  
- **Justin:** US.08, US.09  
- **Luca:** US.08, US.10  
- **Majd:** US.09, US.10, US.12  
- **Ewan:** US.12  

Story points are distributed across all members with moderate complexity balance.  
Higher-risk stories (US.07, US.09, US.11, US.12) are shared across multiple members to reduce implementation risk.

---

# Project Timeline Alignment

- Sprint 1: Core feature foundation completed  
- Sprint 2: Feature expansion, integration, CI/CD automation, visualization  
- All planned functionalities confirmed to be within Sprint 2  
- Gantt chart (US.14) will visually represent weekly progress for Sprint 1 and Sprint 2  
- Team remains on track for Sprint 2 completion deadline  

---

# Discussion & Next Steps

- Continue monitoring CI/CD pipeline stability  
- Complete remaining Sprint 2 feature refinements  
- Finalize and present Gantt chart  
- Prepare for Sprint 2 review and retrospective  
- Ensure all acceptance tests are fully integrated before sprint closure  

---
