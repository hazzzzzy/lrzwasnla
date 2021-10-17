import SqlExpression from '../../../expressions/SqlExpression';
import UserDefinedFilter from '../../../../../types/userdefinedfilters/UserDefinedFilter';
import convertUserDefinedFilterToSqlExpression from '../utils/convertUserDefinedFilterToSqlExpression';
import AbstractSqlDataStore from '../../../../AbstractSqlDataStore';

export default function tryGetWhereClause<T>(
  dataStore: AbstractSqlDataStore,
  subEntityPath: string,
  filters?: (SqlExpression | UserDefinedFilter)[]
) {
  let filtersSql: string = '';

  if (Array.isArray(filters) && filters.length > 0) {
    const sqlExpressionFiltersSql = filters
      .filter((filter) => filter instanceof SqlExpression)
      .filter(
        (sqlExpression) =>
          sqlExpression.subEntityPath === subEntityPath ||
          (subEntityPath === '' && !sqlExpression.subEntityPath) ||
          sqlExpression.subEntityPath === '*'
      )
      .filter((filter) => (filter as SqlExpression).hasValues())
      .map((filter) => (filter as SqlExpression).toSqlString())
      .join(' AND ');

    // TODO: Don't allow READ-DENIED fields to be queried
    const userDefinedFiltersSql = filters
      .filter((filter) => filter instanceof UserDefinedFilter)
      .map((filter, index) => {
        if (
          filter.subEntityPath === subEntityPath ||
          (subEntityPath === '' && !filter.subEntityPath) ||
          filter.subEntityPath === '*'
        ) {
          return convertUserDefinedFilterToSqlExpression(filter as UserDefinedFilter, index);
        }

        return undefined;
      })
      .filter((sqlExpression) => sqlExpression)
      .join(' AND ');

    filtersSql = [sqlExpressionFiltersSql, userDefinedFiltersSql]
      .filter((sqlExpression) => sqlExpression)
      .join(' AND ');
  }

  return filtersSql ? `WHERE ${filtersSql}` : '';
}
