import { SetMetadata } from '@nestjs/common';
import { ChangeRequestActionType } from '../entities/change-request.entity';

export const REQUIRE_DUAL_CONTROL_KEY = 'require_dual_control';

export const RequireDualControl = (actionType: ChangeRequestActionType) =>
  SetMetadata(REQUIRE_DUAL_CONTROL_KEY, actionType);
