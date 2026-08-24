"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { ScheduleAppointmentInput } from "@/lib/visas/types";

/// SUBMITTED → APPOINTMENT.
export function VisaAppointmentDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ScheduleAppointmentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [appointmentAt, setAppointmentAt] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [appointmentReference, setAppointmentReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setAppointmentAt("");
    setAppointmentLocation("");
    setAppointmentReference("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ appointmentAt, appointmentLocation: appointmentLocation.trim() || undefined, appointmentReference: appointmentReference.trim() || undefined });
      toast({ title: "Đã đặt lịch hẹn.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Đặt lịch hẹn visa">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="visa-appointment-at" className="mb-1 block text-sm font-medium">
            Ngày giờ hẹn *
          </label>
          <Input id="visa-appointment-at" type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="visa-appointment-location" className="mb-1 block text-sm font-medium">
            Địa điểm
          </label>
          <Input id="visa-appointment-location" value={appointmentLocation} onChange={(e) => setAppointmentLocation(e.target.value)} />
        </div>
        <div>
          <label htmlFor="visa-appointment-reference" className="mb-1 block text-sm font-medium">
            Mã tham chiếu
          </label>
          <Input id="visa-appointment-reference" value={appointmentReference} onChange={(e) => setAppointmentReference(e.target.value)} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting || !appointmentAt}>
            {submitting ? "Đang lưu..." : "Đặt lịch hẹn"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
