import { PartialType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';

/// Deliberately excludes `status` — status changes go through the dedicated
/// `PATCH /leads/:id/status` endpoint (finite-state-machine validated) or
/// `POST /leads/:id/convert` (the only path to CONVERTED), never a bare field edit.
export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
