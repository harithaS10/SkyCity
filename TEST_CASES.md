# SkyCity Application - Complete Test Cases

## Test Environment Setup
- **Browser**: Chrome, Firefox, Safari, Edge
- **Devices**: Desktop, Tablet, Mobile
- **Screen Sizes**: 1920x1080, 1366x768, 768x1024, 375x667
- **Modes**: Light Mode, Dark Mode

---

## 1. LOGIN & AUTHENTICATION

### TC-001: Cookie Consent Banner
**Priority**: High  
**Pre-requisite**: Open browser in incognito/private mode manually
- **Chrome**: Press `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)
- **Firefox**: Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
- **Edge**: Press `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)
- **Safari**: Press `Cmd+Shift+N` (Mac)

**Steps**:
1. In incognito window, navigate to application URL
2. Verify cookie consent banner appears at bottom (full width)
3. Click "Learn more" - verify cookie policy dialog opens
4. Read the cookie policy content
5. Close dialog by clicking X or outside
6. Click "Decline" button - verify toast message appears saying "Essential cookies are still required..."
7. Refresh page - verify banner doesn't appear again (choice remembered)
8. Open browser DevTools (F12) → Application/Storage tab → Clear all storage
9. Refresh page - verify banner appears again
10. Click "Accept All" button - verify success toast "Cookie preferences saved"
11. Refresh page - verify banner doesn't appear (choice remembered)

**Expected**: 
- Banner shows full width at bottom
- Banner appears only when no consent stored
- "Learn more" opens policy dialog
- "Decline" shows info toast and hides banner
- "Accept All" shows success toast and hides banner
- Choice persists across page refreshes
- Banner reappears after clearing storage

---

### TC-002: Login - Valid Credentials
**Priority**: Critical  
**Steps**:
1. Enter valid username
2. Enter valid password
3. Check "Terms and Conditions" checkbox
4. Click "Sign In"
5. Verify redirect to dashboard

**Expected**: Successful login, redirect to appropriate dashboard

---

### TC-003: Login - Invalid Credentials
**Priority**: High  
**Steps**:
1. Enter invalid username
2. Enter invalid password
3. Click "Sign In"
4. Verify error message appears

**Expected**: Error message "Login failed" or similar

---

### TC-004: Login - Terms Auto-Check
**Priority**: Medium  
**Steps**:
1. Login as staff user (first time)
2. Check terms checkbox and login
3. Logout
4. Login again with same username
5. Verify terms checkbox is auto-checked

**Expected**: Terms checkbox auto-checked for returning users

---

### TC-005: Login - Theme Color Display
**Priority**: Medium  
**Steps**:
1. Verify "SkyCity" text is visible (teal/green color)
2. Verify logo displays correctly
3. Verify primary buttons use theme color
4. Check both mobile and desktop views

**Expected**: Theme color consistent, text visible

---

### TC-006: Login - Password Visibility Toggle
**Priority**: Low  
**Steps**:
1. Enter password
2. Click eye icon
3. Verify password is visible
4. Click eye icon again
5. Verify password is hidden

**Expected**: Password visibility toggles correctly

---

## 2. DASHBOARD & NAVIGATION

### TC-007: Dashboard Load
**Priority**: Critical  
**Steps**:
1. Login successfully
2. Verify dashboard loads
3. Check all stat cards display data
4. Verify charts render
5. Check no console errors

**Expected**: Dashboard loads completely with all data

---

### TC-008: Sidebar Navigation
**Priority**: High  
**Steps**:
1. Click each menu item in sidebar
2. Verify correct page loads
3. Verify active menu item is highlighted
4. Test on desktop and mobile

**Expected**: All navigation works, active state shows

---

### TC-009: Mobile Bottom Navigation
**Priority**: High  
**Steps**:
1. Open on mobile device (< 1024px)
2. Verify bottom navigation appears
3. Click each icon
4. Verify correct page loads
5. Verify active icon is highlighted

**Expected**: Bottom nav works, sits flush at bottom, no scroll space below

---

### TC-010: Header - Fixed on Mobile
**Priority**: High  
**Steps**:
1. Open on mobile device
2. Scroll down the page
3. Verify header stays fixed at top
4. Switch to desktop view
5. Verify header is sticky (scrolls with page)

**Expected**: Header fixed on mobile only, sticky on desktop

---

### TC-011: Dark Mode Toggle
**Priority**: Medium  
**Steps**:
1. Click dark mode toggle in header
2. Verify entire app switches to dark mode
3. Check all pages (dashboard, user management, etc.)
4. Verify table headers have dark background
5. Verify search inputs have dark background
6. Toggle back to light mode
7. Verify everything returns to light theme

**Expected**: Complete dark mode support across all pages

---

## 3. USER MANAGEMENT

### TC-012: User List Display
**Priority**: High  
**Steps**:
1. Navigate to User Management
2. Verify table displays all users
3. Check table header has dark mode support
4. Verify search input has dark mode support
5. Check mobile view shows "Users" (not "User Management")

**Expected**: User list displays correctly, dark mode works

---

### TC-013: User Search
**Priority**: Medium  
**Steps**:
1. Enter user name in search box
2. Verify table filters results
3. Clear search
4. Verify all users show again

**Expected**: Search filters correctly

---

### TC-014: Add New User
**Priority**: Critical  
**Steps**:
1. Click "Add User" button
2. Fill all required fields
3. Select role
4. Click "Save"
5. Verify success message
6. Verify user appears in table

**Expected**: User created successfully

---

### TC-015: Edit User
**Priority**: High  
**Steps**:
1. Click edit icon (pencil) on a user row
2. Verify Edit User dialog opens
3. Verify all fields are pre-filled with current user data
4. Modify user details (name, email, role, etc.)
5. Click "Update User"
6. Verify success message/toast
7. Verify changes reflected in table
8. Refresh page
9. Verify changes persisted

**Expected**: User updated successfully and changes persist

---

### TC-016: Delete User
**Priority**: High  
**Steps**:
1. Click delete icon (trash) on a user row
2. Verify confirmation dialog appears
3. Click "Confirm" or "Delete"
4. Verify success message/toast
5. Verify user removed from table
6. Refresh page
7. Verify user is still deleted

**Expected**: User deleted successfully and permanently

---

### TC-017: Change User Role
**Priority**: High  
**Steps**:
1. Click role dropdown for a user
2. Select different role
3. Verify role updates immediately
4. Refresh page
5. Verify role change persisted

**Expected**: Role changes successfully and persists

---

## 4. PROPERTY MANAGEMENT

### TC-018: Property List Display
**Priority**: High  
**Steps**:
1. Navigate to Property Management
2. Verify table displays all properties
3. Check table header has dark mode support
4. Verify search input has dark mode support
5. Check mobile view shows "Properties" (not "Property Management")

**Expected**: Property list displays correctly, dark mode works

---

### TC-019: Property Search
**Priority**: Medium  
**Steps**:
1. Enter property name in search
2. Verify table filters results
3. Clear search
4. Verify all properties show

**Expected**: Search filters correctly

---

### TC-020: Add New Property
**Priority**: Critical  
**Steps**:
1. Click "Add Property" button
2. Fill property details
3. Select property type
4. Click "Save"
5. Verify success message
6. Verify property appears in table

**Expected**: Property created successfully

---

### TC-021: Edit Property
**Priority**: High  
**Steps**:
1. Click edit icon on a property
2. Modify property details
3. Click "Save"
4. Verify success message
5. Verify changes reflected

**Expected**: Property updated successfully

---

### TC-022: Delete Property
**Priority**: High  
**Steps**:
1. Click delete icon on a property
2. Verify confirmation dialog
3. Click "Confirm"
4. Verify success message
5. Verify property removed

**Expected**: Property deleted successfully

---

## 5. ROLE MANAGEMENT

### TC-023: Role List Display
**Priority**: High  
**Steps**:
1. Navigate to Role Management
2. Verify table displays all roles
3. Check table header has dark mode support
4. Verify "All Roles" title has dark mode support

**Expected**: Role list displays correctly, dark mode works

---

### TC-024: Edit Role Permissions
**Priority**: Critical  
**Steps**:
1. Click edit icon on a role
2. Toggle various permissions
3. Click "Save"
4. Verify success message
5. Login as user with that role
6. Verify permissions applied

**Expected**: Permissions update correctly

---

## 6. WORK ALLOCATION & TASKS

### TC-025: View My Tasks
**Priority**: Critical  
**Steps**:
1. Navigate to My Tasks
2. Verify tasks display
3. Check task status badges
4. Verify due dates show correctly 

**Expected**: Tasks display with correct information

---

### TC-026: Create Work Allocation
**Priority**: Critical  
**Steps**:
1. Navigate to Work Allocation
2. Click "Assign Task"
3. Fill all details
4. Select assignee
5. Set due date
6. Click "Save"
7. Verify success message

**Expected**: Task created and assigned

---

### TC-027: Update Task Status
**Priority**: High  
**Steps**:
1. Open a task
2. Change status (Pending → In Progress → Completed)
3. Verify status updates
4. Check status badge color changes

**Expected**: Status updates correctly

---

## 7. CHAT & AI BOT

### TC-028: AI Bot - Personal Chat
**Priority**: High  
**Steps**:
1. Navigate to Chat → AI Bot
2. Send a message
3. Verify bot responds
4. Logout and login as different user
5. Navigate to AI Bot
6. Verify previous chat is NOT visible
7. Send new message
8. Logout and login as first user
9. Verify first user's chat history is preserved

**Expected**: Each user has separate AI chat history

---

### TC-029: AI Bot - Theme Colors
**Priority**: Medium  
**Steps**:
1. Navigate to AI Bot
2. Verify header uses primary theme color (teal/green)
3. Verify bot avatar uses primary color
4. Verify send button uses primary color
5. Verify quick action buttons use primary color
6. Check NO violet/indigo colors appear

**Expected**: All AI Bot elements use primary theme color

---

### TC-030: Direct Messages
**Priority**: High  
**Steps**:
1. Navigate to Chat → Direct Messages
2. Select a user
3. Send a message
4. Verify message appears
5. Login as that user
6. Verify message received

**Expected**: DM works between users

---

### TC-031: Group Chat
**Priority**: High  
**Steps**:
1. Navigate to Chat → Group
2. Create new group (admin only)
3. Add members
4. Send message
5. Verify all members receive message

**Expected**: Group chat works correctly

---

### TC-032: Group Chat - Theme Colors
**Priority**: Medium  
**Steps**:
1. Navigate to Group Chat
2. Verify "AI Bot" tab uses primary color (not violet)
3. Verify group avatars use primary color (not indigo)
4. Check desktop and mobile views
5. Verify NO violet/indigo colors appear

**Expected**: All group chat elements use primary theme color

---

## 8. MOBILE RESPONSIVENESS

### TC-033: Mobile View - Property Management
**Priority**: High  
**Steps**:
1. Open on mobile (< 1024px)
2. Navigate to Property Management
3. Verify blue gradient header
4. Verify glassmorphic stat cards
5. Verify modern card designs
6. Verify title shows "Properties" (not "Property Management")
7. Check dark mode support

**Expected**: Mobile view matches design, consistent with other pages

---

### TC-034: Mobile View - User Management
**Priority**: High  
**Steps**:
1. Open on mobile
2. Navigate to User Management
3. Verify blue gradient header
4. Verify glassmorphic stat cards
5. Verify title shows "Users" (not "User Management")
6. Check dark mode support

**Expected**: Mobile view consistent with Property Management

---

### TC-035: Mobile View - Chat
**Priority**: High  
**Steps**:
1. Open on mobile
2. Navigate to Chat
3. Verify tab switcher works
4. Verify chat list displays correctly
5. Open a conversation
6. Verify messages display correctly
7. Send a message
8. Verify input area works

**Expected**: Chat fully functional on mobile

---

## 9. TERMS & CONDITIONS

### TC-036: Terms Management
**Priority**: Medium  
**Steps**:
1. Navigate to Terms & Conditions
2. Verify NO icon appears in header (desktop)
3. Verify NO icon appears in mobile view
4. Edit terms content
5. Save changes
6. Verify success message

**Expected**: Terms page clean, no icons

---

## 10. EMPLOYEE TASK MANAGEMENT

### TC-037: Employee Task Header
**Priority**: Medium  
**Steps**:
1. Navigate to Employee Task Management
2. Verify header text uses theme color (not black)
3. Check dark mode support
4. Verify header matches other modules

**Expected**: Header uses primary theme color

---

## 11. SCROLLING & PERFORMANCE

### TC-038: Page Scrolling
**Priority**: Critical  
**Steps**:
1. Open any page with content
2. Use mouse wheel to scroll
3. Use trackpad to scroll
4. Use touch to scroll (mobile)
5. Verify scrolling works smoothly
6. Verify NO need to use scrollbar only

**Expected**: Page scrolls with wheel/trackpad/touch, not just scrollbar

---

### TC-039: Table Scrolling
**Priority**: High  
**Steps**:
1. Open User Management or Property Management
2. Verify table has scrollbar if content overflows
3. Scroll table content
4. Verify table header stays fixed
5. Verify smooth scrolling

**Expected**: Table scrolls independently, header fixed

---

## 12. CROSS-BROWSER TESTING

### TC-040: Chrome Compatibility
**Priority**: High  
**Steps**:
1. Test all features in Chrome
2. Verify no console errors
3. Check all UI elements render correctly

**Expected**: Full functionality in Chrome

---

### TC-041: Firefox Compatibility
**Priority**: High  
**Steps**:
1. Test all features in Firefox
2. Verify no console errors
3. Check all UI elements render correctly

**Expected**: Full functionality in Firefox

---

### TC-042: Safari Compatibility
**Priority**: Medium  
**Steps**:
1. Test all features in Safari
2. Verify no console errors
3. Check all UI elements render correctly

**Expected**: Full functionality in Safari

---

### TC-043: Edge Compatibility
**Priority**: Medium  
**Steps**:
1. Test all features in Edge
2. Verify no console errors
3. Check all UI elements render correctly

**Expected**: Full functionality in Edge

---

## 13. SECURITY & PERMISSIONS

### TC-044: Role-Based Access Control
**Priority**: Critical  
**Steps**:
1. Login as Staff user
2. Verify limited menu items
3. Try to access admin pages directly via URL
4. Verify access denied or redirect
5. Login as Admin
6. Verify full access

**Expected**: Permissions enforced correctly

---

### TC-045: Session Management
**Priority**: High  
**Steps**:
1. Login successfully
2. Close browser
3. Reopen browser
4. Navigate to app
5. Verify still logged in (if "Remember Me")
6. Or verify redirected to login

**Expected**: Session persists or expires correctly

---

### TC-046: Logout
**Priority**: High  
**Steps**:
1. Login successfully
2. Click logout
3. Verify redirect to login page
4. Try to access dashboard via URL
5. Verify redirect to login

**Expected**: Logout clears session, prevents access

---

## 14. DATA VALIDATION

### TC-047: Form Validation - Required Fields
**Priority**: High  
**Steps**:
1. Open any form (Add User, Add Property, etc.)
2. Leave required fields empty
3. Click "Save"
4. Verify validation errors appear
5. Fill required fields
6. Verify errors clear

**Expected**: Required field validation works

---

### TC-048: Form Validation - Email Format
**Priority**: Medium  
**Steps**:
1. Open Add User form
2. Enter invalid email format
3. Verify validation error
4. Enter valid email
5. Verify error clears

**Expected**: Email validation works

---

### TC-049: Form Validation - Date Fields
**Priority**: Medium  
**Steps**:
1. Open task assignment form
2. Select past date for due date
3. Verify validation error or warning
4. Select future date
5. Verify accepted

**Expected**: Date validation works

---

## 15. NOTIFICATIONS

### TC-050: Toast Notifications
**Priority**: Medium  
**Steps**:
1. Perform various actions (create, update, delete)
2. Verify success toast appears
3. Verify error toast appears on failure
4. Check toast auto-dismisses
5. Verify toast position and styling

**Expected**: Toasts display correctly for all actions

---

## 16. PERFORMANCE

### TC-051: Page Load Time
**Priority**: Medium  
**Steps**:
1. Clear cache
2. Login
3. Measure dashboard load time
4. Navigate to different pages
5. Measure load times

**Expected**: Pages load within 2-3 seconds

---

### TC-052: Large Data Sets
**Priority**: Medium  
**Steps**:
1. Navigate to page with many records (100+)
2. Verify table renders
3. Test search/filter performance
4. Test scrolling performance

**Expected**: No lag with large data sets

---

## 17. EDGE CASES

### TC-053: Empty States
**Priority**: Low  
**Steps**:
1. Navigate to pages with no data
2. Verify empty state messages display
3. Verify helpful text appears
4. Check styling is consistent

**Expected**: Empty states display correctly

---

### TC-054: Long Text Handling
**Priority**: Low  
**Steps**:
1. Enter very long text in fields
2. Verify text truncates with ellipsis
3. Verify no layout breaks
4. Check tooltips show full text

**Expected**: Long text handled gracefully

---

### TC-055: Special Characters
**Priority**: Low  
**Steps**:
1. Enter special characters in text fields
2. Verify no errors
3. Verify data saves correctly
4. Verify data displays correctly

**Expected**: Special characters handled correctly

---

## 18. ACCESSIBILITY

### TC-056: Keyboard Navigation
**Priority**: Medium  
**Steps**:
1. Use Tab key to navigate
2. Verify focus indicators visible
3. Use Enter to activate buttons
4. Use Escape to close dialogs

**Expected**: Full keyboard navigation support

---

### TC-057: Screen Reader Compatibility
**Priority**: Low  
**Steps**:
1. Enable screen reader
2. Navigate through app
3. Verify labels are read correctly
4. Verify buttons are announced

**Expected**: Screen reader can navigate app

---

## 19. BRANDING & THEMING

### TC-058: Theme Color Consistency
**Priority**: High  
**Steps**:
1. Check all pages
2. Verify primary color is teal/green (not violet/indigo)
3. Check buttons, links, badges
4. Verify NO violet or indigo colors anywhere
5. Check both light and dark modes

**Expected**: Consistent theme color throughout app

---

### TC-059: Logo Display
**Priority**: Medium  
**Steps**:
1. Check logo in header
2. Check logo on login page
3. Verify logo is clear and visible
4. Check on different screen sizes

**Expected**: Logo displays correctly everywhere

---

## 20. FINAL CHECKS

### TC-060: Console Errors
**Priority**: High  
**Steps**:
1. Open browser console
2. Navigate through entire app
3. Perform various actions
4. Check for any errors or warnings

**Expected**: No console errors

---

### TC-061: Network Requests
**Priority**: Medium  
**Steps**:
1. Open Network tab
2. Navigate through app
3. Verify API calls succeed
4. Check for failed requests

**Expected**: All API calls successful

---

### TC-062: Memory Leaks
**Priority**: Low  
**Steps**:
1. Open Performance tab
2. Navigate through app multiple times
3. Check memory usage
4. Verify no continuous memory increase

**Expected**: No memory leaks

---

## TEST SUMMARY TEMPLATE

| Test Case ID | Test Case Name | Status | Priority | Notes |
|--------------|----------------|--------|----------|-------|
| TC-001 | Cookie Consent Banner | ⬜ Pass / ❌ Fail | High | |
| TC-002 | Login - Valid Credentials | ⬜ Pass / ❌ Fail | Critical | |
| ... | ... | ... | ... | |

---

## BUG REPORT TEMPLATE

**Bug ID**: BUG-XXX  
**Title**: [Short description]  
**Severity**: Critical / High / Medium / Low  
**Priority**: P1 / P2 / P3 / P4  

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**: [What should happen]  
**Actual Result**: [What actually happens]  
**Environment**: Browser, OS, Screen size  
**Screenshots**: [Attach if applicable]  
**Console Errors**: [Copy any errors]

---

## TESTING CHECKLIST

### Before Starting
- [ ] Test environment is set up
- [ ] Test data is prepared
- [ ] All test accounts are ready
- [ ] Browsers are updated

### During Testing
- [ ] Follow test cases step by step
- [ ] Document all issues found
- [ ] Take screenshots of bugs
- [ ] Note console errors
- [ ] Test on multiple browsers
- [ ] Test on multiple devices

### After Testing
- [ ] All test cases executed
- [ ] All bugs documented
- [ ] Test summary completed
- [ ] Report submitted

---

## PRIORITY DEFINITIONS

- **Critical**: Core functionality, blocks usage
- **High**: Important features, major impact
- **Medium**: Moderate impact, workarounds exist
- **Low**: Minor issues, cosmetic problems

---

## TESTING TIPS

1. **Test systematically** - Follow test cases in order
2. **Document everything** - Screenshots, errors, steps
3. **Test edge cases** - Empty data, long text, special characters
4. **Test all roles** - Admin, Staff, User, etc.
5. **Test all devices** - Desktop, tablet, mobile
6. **Test both modes** - Light and dark mode
7. **Clear cache** - Between major test sessions
8. **Check console** - Always have developer tools open
9. **Be thorough** - Don't skip steps
10. **Report clearly** - Detailed bug reports help developers

---

**Good luck with testing! 🚀**
