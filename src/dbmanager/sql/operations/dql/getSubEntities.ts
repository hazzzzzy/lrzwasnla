import { JSONPath } from 'jsonpath-plus';
import AbstractSqlDbManager from '../../../AbstractSqlDbManager';
import getEntityById from './getEntityById';
import createBackkErrorFromError from '../../../../errors/createBackkErrorFromError';
import { PostQueryOperations } from '../../../../types/postqueryoperations/PostQueryOperations';
import updateDbLocalTransactionCount from './utils/updateDbLocalTransactionCount';
import { PromiseErrorOr } from '../../../../types/PromiseErrorOr';
import { BackkEntity } from '../../../../types/entities/BackkEntity';
import DefaultPostQueryOperations from '../../../../types/postqueryoperations/DefaultPostQueryOperations';

export default async function getSubEntities<T extends BackkEntity, U extends object>(
  dbManager: AbstractSqlDbManager,
  _id: string,
  subEntityPath: string,
  EntityClass: new () => T,
  postQueryOperations?: PostQueryOperations,
  responseMode?: 'first' | 'all'
): PromiseErrorOr<U[]> {
  updateDbLocalTransactionCount(dbManager);
  // noinspection AssignmentToFunctionParameterJS
  EntityClass = dbManager.getType(EntityClass);

  try {
    const [entity, error] = await getEntityById(
      dbManager,
      _id,
      EntityClass,
      postQueryOperations ?? new DefaultPostQueryOperations(),
      false
    );
    const subItems: U[] = JSONPath({ json: entity?.data ?? null, path: subEntityPath });
    return responseMode === 'first' ? [[subItems[0]], error] : [subItems, error];
  } catch (error) {
    return [null, createBackkErrorFromError(error)];
  }
}
