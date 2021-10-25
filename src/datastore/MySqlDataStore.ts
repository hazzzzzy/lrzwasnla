import mysql, { Pool } from 'mysql2/promise';
import AbstractSqlDataStore from './AbstractSqlDataStore';
import throwException from '../utils/exception/throwException';
import getDbNameFromServiceName from "../utils/getDbNameFromServiceName";

export default class MySqlDataStore extends AbstractSqlDataStore {
  private static readonly MAX_CHAR_TYPE_LENGTH = 16383;
  private readonly pool: Pool;
  private readonly host: string;
  private readonly port: string;
  private readonly user: string;
  private readonly password: string;

  constructor() {
    super(getDbNameFromServiceName());
    this.host = process.env.MYSQL_HOST || throwException('MYSQL_HOST environment variable must be defined');
    this.port = process.env.MYSQL_PORT || throwException('MYSQL_PORT environment variable must be defined');
    this.user = process.env.MYSQL_USER || throwException('MYSQL_USER environment variable must be defined');
    this.password =
      process.env.MYSQL_PASSWORD || throwException('MYSQL_PASSWORD environment variable must be defined');

    this.pool = mysql.createPool({
      host: this.host,
      port: parseInt(this.port, 10),
      user: this.user,
      password: this.password,
      waitForConnections: true,
      connectionLimit: 100,
      queueLimit: 0
    });
  }

  async isDbReady(): Promise<boolean> {
    try {
      await this.tryExecuteSqlWithoutCls(
        `SET SESSION SQL_MODE=ANSI_QUOTES`,
        undefined,
        false
      );
      await this.tryExecuteSqlWithoutCls(
        `SELECT * FROM ${this.schema.toLowerCase()}.__backk_db_initialization`,
        undefined,
        false
      );
      return super.isDbReady();
    } catch {
      try {
        await this.tryExecuteSqlWithoutCls(
          `CREATE DATABASE IF NOT EXISTS ${this.schema.toLowerCase()}`,
          undefined,
          false
        );
        return super.isDbReady();
      } catch {
        return false;
      }
    }
  }

  getDataStoreType(): string {
    return 'MySQL';
  }

  getDbHost(): string {
    return this.host;
  }

  getPool(): any {
    return this.pool;
  }

  getConnection(): Promise<any> {
    return mysql.createConnection({
      host: this.host,
      user: this.user,
      password: this.password,
      database: this.schema
    });
  }

  releaseConnection(connection?: any) {
    connection?.destroy();
  }

  getIdColumnType(): string {
    return 'BIGINT AUTO_INCREMENT PRIMARY KEY';
  }

  getTimestampType(): string {
    return 'TIMESTAMP';
  }

  getVarCharType(maxLength: number): string {
    if (maxLength < MySqlDataStore.MAX_CHAR_TYPE_LENGTH) {
      return `VARCHAR(${maxLength})`;
    }
    return 'TEXT';
  }

  getResultRows(result: any): any[] {
    return result[0];
  }

  getResultFields(result: any): any[] {
    return result[1];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getValuePlaceholder(index: number): string {
    return '?';
  }

  getReturningIdClause(): string {
    return '';
  }

  getBeginTransactionStatement(): string {
    return 'START TRANSACTION';
  }

  getInsertId(result: any): number {
    return result?.[0]?.insertId;
  }

  getIdColumnCastType(): string {
    return 'CHAR(24)';
  }

  executeSql(connection: any, sqlStatement: string, values?: any[]): Promise<any> {
    return connection.execute(sqlStatement, values);
  }

  executeSqlWithNamedPlaceholders(connection: any, sqlStatement: string, values: object): Promise<any> {
    connection.config.namedPlaceholders = true;
    const result = connection.execute(sqlStatement, values);
    connection.config.namedPlaceholders = false;
    return result;
  }

  getModifyColumnStatement(
    schema: string,
    tableName: string,
    columnName: string,
    columnType: string
  ): string {
    return `ALTER TABLE ${schema?.toLowerCase()}.${tableName.toLowerCase()} MODIFY COLUMN ${columnName.toLowerCase()} ${columnType}`;
  }

  isDuplicateEntityError(error: Error): boolean {
    return error.message.startsWith('Duplicate entry');
  }

  getAffectedRows(result: any): number {
    return result.affectedRows;
  }

  shouldConvertTinyIntegersToBooleans(): boolean {
    return true;
  }

  getBooleanType(): string {
    return 'TINYINT';
  }

  getUpdateForClause(): string {
    return 'FOR UPDATE';
  }

  castAsBigint(columnName: string): string {
    return `CAST(${columnName} AS UNSIGNED)`;
  }
}
