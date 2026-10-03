# 30th of January 2026 - Sprint 1: Meeting 2

## Attendance
- Justin Le
- Ewan St-Louis
- Majd Tarraf
- Luca Lapenna
- Noe Gabriel Menacho Tardieu
- Becky Zhang

## Scribe
- Becky Zhang

## Agenda
| Topic | Notes | 
| ------------- | ------------- |
| User Stories | - Created and described user stories and tasks and logged them on the Sprint Plan and as issues on the repository.|
|  | - Assigned story points, due date, priority and risk for each story. |
|  | - Assigned a responsible member for each task. |
| US.01 | - Initialized the UI. |
|  | Luca spent 30 minutes on user story 1 |
| Update | - Update the TA about our current progress and sprint plan. |


## Responsibilities

| Issue # | User Story Description | Tasks | Story Points | Story Points Justification | Due Date | Priority | Risk | Risk Justification | Assigned Member |
|--------|------------------------|-------|--------------|---------------------------|----------|----------|------|--------------------|-----------------|
| US.01 | As a new user, I want to create an account by entering my email and password so that I can access the MealMajor application. | Task.01.01 Make a registration UI<br>Task.01.02 Client-side validation<br>Task.01.03 Registration API<br>Task.01.04 Error handling | 5 | This story involves both frontend and backend development, validation logic, API communication, and secure handling of user data, making it moderately complex. | 2/4/2026 | HIGH | MEDIUM | Registration handles sensitive user data and relies on validation and API reliability. Errors could prevent account creation or introduce security issues. | Becky, Noe, Luca |
| US.02 | As a registered user, I want to log in using my credentials so that I can securely access my account. | Task.02.01 Login UI<br>Task.02.02 Login API<br>Task.02.03 Credential validation<br>Task.02.04 Login feedback | 5 | Similar in complexity to registration, this story requires secure authentication, backend logic, and clear user feedback, justifying the same point value. | 2/4/2026 | HIGH | MEDIUM | Login is critical for secure access. Issues with authentication or feedback could block users or weaken security. | Becky, Noe, Luca |
| US.03 | As a logged-in user, I want to view my profile information so that I can see my account details and preferences. | Task.03.01 Profile UI layout<br>Task.03.02 Fetch profile API<br>Task.03.03 Display profile data<br>Task.03.04 Handle errors of empty data | 4 | This feature is read-only and mainly involves data fetching and display, resulting in moderate effort but less complexity than authentication features. | 2/5/2026 | MEDIUM | LOW | This is a read-only feature. Errors mainly affect user experience, not system security or stability. | Luca |
| US.04 | As a user, I want to specify my diet preferences so that the application can tailor content to my needs. | Task.04.01 Diet preferences UI<br>Task.04.02 Save preferences<br>Task.04.03 Diet data handling<br>Task.04.04 Load preferences | 4 | Requires form handling, data persistence, and retrieval, but does not involve complex logic or security-sensitive operations. | 2/5/2026 | MEDIUM | LOW | Incorrect saving or loading of preferences would only affect personalization, not core functionality. | Justin, Ewan |
| US.05 | As a user, I want to specify my allergies so that I can avoid recipes that may be unsafe for me. | Task.05.01 Allergy input UI<br>Task.05.02 Save allergy data<br>Task.05.03 Add/Remove allergy data<br>Task.05.04 Display allergy data | 4 | Similar in scope to diet preferences, this story includes CRUD-style operations and UI updates with limited system complexity. | 2/6/2026 | MEDIUM | LOW | Errors could cause incorrect filtering but do not impact authentication or system security. | Majd, Ewan |
| US.06 | As a logged-in user, I want to log out of my account so that my session remains secure. | Task.06.01 Logout button<br>Task.06.02 Clear session<br>Task.06.03 Redirect user to login page | 2 | Logout functionality is simple, involving session clearing and redirection, requiring minimal development effort. | 2/6/2026 | LOW | LOW | Logout is straightforward. Issues would have limited impact and are easy to detect. | Majd |
|  | **Total** |  | **24** |  |  |  |  |  |  |
