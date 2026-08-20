import { IsIn } from 'class-validator';

const DECISIONS = ['ACCEPT', 'DECLINE'] as const;

export class RespondOfferDto {
  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];
}
