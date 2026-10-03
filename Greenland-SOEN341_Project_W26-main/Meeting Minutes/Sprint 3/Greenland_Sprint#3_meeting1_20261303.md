# 13th of March 2026 - Sprint 3: Meeting 1

## Attendance
- Justin Le  
- Ewan St-Louis  
- Majd Tarraf  
- Luca Lapenna  
- Noe Gabriel Menacho Tardieu  
- Becky Zhang  

## Scribe
- Noe Gabriel Menacho Tardieu

## Agenda  
- Conduct a retrospective on Sprint 2 planning and execution  
- Ensure all features and deliverables are fully prepared for the demonstration  
- Increase testing coverage to validate system stability and prevent last-minute issues
  
# Objectives
- Define and justify the priority level for each Sprint 3 user story  
- Analyze and justify the risk level associated with each user story  
- Ensure alignment between priority, risk, and overall project goals  
- Document justifications clearly for inclusion in project planning artifacts  

## Sprint 3 – User Stories Breakdown

| Issue # | User Story Description | Tasks | SP | Due Date | Priority | Priority Justification | Risk | Risk Justification | Assigned |
|--------|----------------------|-------|----|-----------|----------|------------------------|------|---------------------|----------|
| **US.15** | Create a weekly meal plan | Design MealPlan data model<br>Implement backend API endpoint<br>Store week identifier with user ID<br>Validate only one plan per week<br>Connect backend to frontend | 5 | 2026-03-27 | High | Foundational feature; all other planner functionalities depend on it | Medium | Requires new data model and validation constraints, increasing backend complexity | Becky Zhang |
| **US.16** | View meals in a weekly grid | Design weekly planner UI<br>Implement grid layout (7x meals)<br>Fetch weekly plan<br>Display recipes in grid | 5 | 2026-03-27 | High | Essential for usability and visualization of the meal plan | Medium | Complex frontend layout and backend synchronization may cause integration issues | Team Member 2 |
| **US.17** | Assign recipe to day & meal type | Create selection modal<br>Allow day & meal selection<br>Implement save API<br>Update grid dynamically | 5 | 2026-03-27 | High | Core functionality needed to populate the planner with meals | Medium | Requires coordination between UI interactions and backend persistence | Team Member 3 |
| **US.18** | Edit/remove meals | Add edit/delete buttons<br>Implement update API<br>Implement delete API<br>Refresh UI | 4 | 2026-03-27 | Medium | Improves usability but not required for initial functionality | Low | Based on existing CRUD operations, making implementation straightforward | Team Member 4 |
| **US.19** | Prevent duplicate meal entries | Backend validation for duplicates<br>Frontend validation<br>Error messages<br>Validation function | 5 | 2026-03-27 | Medium | Ensures data integrity and prevents logical conflicts | Low | Simple validation logic using existing data structures |
| Team Member 5 |





