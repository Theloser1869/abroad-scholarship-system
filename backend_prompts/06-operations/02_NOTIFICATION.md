# PHASE 06B – NOTIFICATION ENGINE

Implement in-app + email notification.

Events:
deadline
assignment
status change
approval request
document request
application deadline
scholarship deadline
visa appointment
payment overdue

Default reminder:
30/14/7/3/1 days
Overdue daily

Prevent duplicate sends.
Use queue/background worker if existing architecture supports it.

Do not expose sensitive information in notification body.
