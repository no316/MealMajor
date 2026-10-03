# 20th of March 2026 - Sprint 3: Meeting 2

## Attendance
- Justin Le  
- Ewan St-Louis  
- Majd Tarraf  
- Luca Lapenna  
- Noe Gabriel Menacho Tardieu  
- Becky Zhang  

## Scribe
- Noe Gabriel Menacho Tardieu  


## AI Feature Integration (US.20 & US.21)

During Sprint 3, the team introduced an AI-powered feature to enhance user experience by generating personalized meal suggestions. This feature allows users to receive a 3-course meal plan based on their diet preferences and selected cuisine.

The implementation is divided into two main user stories:

- **US.20 (Backend Logic):** Implemented by **Luca, Majd, and Justin**, this story includes **Task 20.01 (Gemini API call abstraction)**, **Task 20.02 (output schema definition)**, and **Task 20.03 (backend storage of preferences and results)**. These tasks focus on integrating the AI service and ensuring data persistence.

- **US.21 (Frontend Interaction):** Implemented by **Ewan, Noe, and Becky**, this story includes **Task 21.01 (frontend page implementation)**, **Task 21.02 (user questionnaire)**, and **Task 21.03 (linking the page to the homepage)**. These tasks focus on user interaction and accessibility of the AI-generated content.

This separation ensures a clear distinction between backend processing and frontend interaction, improving maintainability and modularity of the system.

### Risk Justification for AI Features

- **US.20 (Risk: Low):** Since **Luca, Majd, and Justin** are handling backend-related tasks (**Task 20.01–20.03**), the implementation remains controlled and consistent with existing backend patterns. The use of an API abstraction isolates external dependencies, and storing outputs follows established database practices, minimizing system-wide risk.

- **US.21 (Risk: Low):** With **Ewan, Noe, and Becky** focusing on frontend tasks (**Task 21.01–21.03**), the feature remains independent from core backend logic. Issues are limited to UI behavior and user interaction, which reduces the likelihood of impacting overall system stability.

---

## Task Distribution

Task allocation for Sprint 3 was based on balancing workload and aligning tasks with each member’s strengths:

- **Majd and Justin** were assigned to backend-heavy tasks such as **US.15 (Task.15.02–15.04)** and **US.20**, leveraging their experience with API development and data handling.  
- **Luca** contributed to both backend and feature extension tasks (**US.18, US.20**), helping maintain consistency across CRUD operations and new integrations.  
- **Becky and Noe** focused on frontend and testing-related tasks such as **US.16 and US.22**, ensuring proper UI implementation and system reliability.  
- **Ewan** worked on interactive and UI-driven features (**US.17, US.19, US.21**), supporting user-facing functionality and validation logic.  

Higher complexity tasks (e.g., **US.15, US.17, US.20**) were assigned to multiple members to reduce risk and encourage collaboration, while lower-risk tasks (e.g., **US.18, US.19, US.21**) were distributed to maintain balance and allow parallel progress.

Overall, the distribution ensured that all team members contributed evenly while aligning responsibilities with their technical strengths.
