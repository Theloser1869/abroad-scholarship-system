"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { COMMISSION_BASES, type CommissionBasis, type CommissionRule, type CreateCommissionRuleInput, type UpdateCommissionRuleInput } from "@/lib/commission-rules/types";

const BASIS_LABEL: Record<CommissionBasis, string> = {
  CONTRACT_VALUE: "Giá trị hợp đồng",
  PAYMENT_COLLECTED: "Số tiền đã thu",
  FIXED: "Cố định",
};

/// Create/edit CommissionRule (F06 instruction §21) — config data, never a fact that
/// happened (that's CommissionTransaction). The backend cross-validates `basis` against
/// `percentageRate`/`fixedAmount` (`400 FIXED_AMOUNT_REQUIRED`/etc.); this form mirrors that
/// as UX guidance (hiding the irrelevant field) but never substitutes for the real
/// server-side check — no rule-matching/precedence is computed here (F06 instruction §21:
/// "Không tính rule match ở frontend").
export function CommissionRuleFormDialog({
  open,
  onClose,
  rule,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  rule?: CommissionRule;
  onSubmit: (input: CreateCommissionRuleInput | UpdateCommissionRuleInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!rule;
  const [partnerProgramId, setPartnerProgramId] = useState("");
  const [basis, setBasis] = useState<CommissionBasis>("CONTRACT_VALUE");
  const [percentageRate, setPercentageRate] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [conditions, setConditions] = useState("");
  const [priority, setPriority] = useState("0");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setPartnerProgramId(rule?.partnerProgramId ?? "");
    setBasis(rule?.basis ?? "CONTRACT_VALUE");
    setPercentageRate(rule?.percentageRate ?? "");
    setFixedAmount(rule?.fixedAmount ?? "");
    setCurrency(rule?.currency ?? "");
    setConditions(rule?.conditions ?? "");
    setPriority(rule?.priority != null ? String(rule.priority) : "0");
    setEffectiveDate(rule?.effectiveDate ? rule.effectiveDate.slice(0, 10) : "");
    setExpiryDate(rule?.expiryDate ? rule.expiryDate.slice(0, 10) : "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        partnerProgramId: partnerProgramId.trim() || undefined,
        basis,
        percentageRate: basis !== "FIXED" && percentageRate ? Number(percentageRate) : undefined,
        fixedAmount: basis === "FIXED" && fixedAmount ? Number(fixedAmount) : undefined,
        currency: currency.trim().toUpperCase(),
        conditions: conditions.trim() || undefined,
        priority: priority ? Number(priority) : undefined,
        effectiveDate: effectiveDate || undefined,
        expiryDate: expiryDate || undefined,
      } satisfies CreateCommissionRuleInput);
      toast({ title: isEdit ? "Đã cập nhật quy tắc hoa hồng." : "Đã tạo quy tắc hoa hồng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa quy tắc hoa hồng" : "Tạo quy tắc hoa hồng"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="commission-rule-partner-program" className="mb-1 block text-sm font-medium">
            Partner Program ID (để trống = áp dụng toàn bộ đối tác)
          </label>
          <Input id="commission-rule-partner-program" value={partnerProgramId} onChange={(e) => setPartnerProgramId(e.target.value)} placeholder="UUID chương trình đối tác (tùy chọn)" />
        </div>
        <div>
          <label htmlFor="commission-rule-basis" className="mb-1 block text-sm font-medium">
            Cơ sở tính *
          </label>
          <select id="commission-rule-basis" value={basis} onChange={(e) => setBasis(e.target.value as CommissionBasis)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
            {COMMISSION_BASES.map((b) => (
              <option key={b} value={b}>
                {BASIS_LABEL[b]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {basis !== "FIXED" ? (
            <div>
              <label htmlFor="commission-rule-rate" className="mb-1 block text-sm font-medium">
                Tỷ lệ (phân số, 0.10 = 10%) *
              </label>
              <Input id="commission-rule-rate" type="number" min="0" step="0.0001" value={percentageRate} onChange={(e) => setPercentageRate(e.target.value)} required />
            </div>
          ) : (
            <div>
              <label htmlFor="commission-rule-fixed" className="mb-1 block text-sm font-medium">
                Số tiền cố định *
              </label>
              <Input id="commission-rule-fixed" type="number" min="0" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} required />
            </div>
          )}
          <div>
            <label htmlFor="commission-rule-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ *
            </label>
            <Input id="commission-rule-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required placeholder="USD" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="commission-rule-priority" className="mb-1 block text-sm font-medium">
              Độ ưu tiên
            </label>
            <Input id="commission-rule-priority" type="number" step="1" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="commission-rule-effective" className="mb-1 block text-sm font-medium">
              Ngày hiệu lực
            </label>
            <Input id="commission-rule-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="commission-rule-expiry" className="mb-1 block text-sm font-medium">
              Ngày hết hạn
            </label>
            <Input id="commission-rule-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="commission-rule-conditions" className="mb-1 block text-sm font-medium">
            Điều kiện áp dụng
          </label>
          <Textarea
            id="commission-rule-conditions"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={2}
          />
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo quy tắc"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
