# PHASE 05B – PAYMENT

Implement payment schedule.

Fields:
payment_id
contract_id
installment_no
amount
currency
due_date
paid_amount
paid_date
method
reference
status
receipt_document_id

Statuses:
Pending
Partially Paid
Paid
Overdue
Refunded
Waived

Handle:
partial payment
overpayment
duplicate reference
refund
waiver
overdue

Finance view:
schedule
outstanding
paid
overdue
history

Student only sees permitted finance information.
