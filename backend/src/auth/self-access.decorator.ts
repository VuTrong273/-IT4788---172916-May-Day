import { SetMetadata } from '@nestjs/common';

export const SELF_ACCESS_KEY = 'selfAccess';
// Authentication remains mandatory; this exposes only the caller's own access.
export const SelfAccess = () => SetMetadata(SELF_ACCESS_KEY, true);
