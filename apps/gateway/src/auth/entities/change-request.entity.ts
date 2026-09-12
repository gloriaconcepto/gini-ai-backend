export type ChangeRequestStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

export type ChangeRequestActionType =
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'RESET_PASSWORD'
  | 'ASSIGN_ROLE'
  | 'REMOVE_ROLE'
  | 'CREATE_ROLE'
  | 'DELETE_ROLE'
  | 'CREATE_CLIENT'
  | 'DELETE_CLIENT'
  | 'CREATE_IDP'
  | 'UPDATE_IDP'
  | 'DELETE_IDP'
  | 'CREATE_GROUP'
  | 'CREATE_SUBGROUP'
  | 'UPDATE_GROUP'
  | 'DELETE_GROUP'
  | 'ASSIGN_GROUP_ROLE'
  | 'REMOVE_GROUP_ROLE'
  | 'ADD_USER_TO_GROUP'
  | 'REMOVE_USER_FROM_GROUP'
  | 'CREATE_IDP_MAPPER'
  | 'DELETE_IDP_MAPPER'
  | 'SYNC_IDP_HIERARCHY';

export interface ChangeRequest {
  id: string;
  tenantId: string;
  actionType: ChangeRequestActionType;
  targetResource: string;
  targetResourceId?: string;
  payload: Record<string, any>;
  makerId: string;
  makerUsername: string;
  checkerId?: string;
  checkerUsername?: string;
  status: ChangeRequestStatus;
  reviewComment?: string;
  executionResult?: any;
  executionError?: string;
  createdAt: Date;
  updatedAt: Date;
  executedAt?: Date;
}
