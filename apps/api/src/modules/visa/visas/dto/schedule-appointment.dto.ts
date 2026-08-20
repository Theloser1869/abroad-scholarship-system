import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/// "Appointment phải có appointment information phù hợp" — 09-visa.
export class ScheduleAppointmentDto {
  @IsDateString()
  appointmentAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appointmentLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appointmentReference?: string;
}
