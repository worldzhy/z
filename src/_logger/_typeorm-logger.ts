import {Logger as TypeOrmLogger, QueryRunner} from 'typeorm';
import {CustomLoggerService} from './_custom-logger.service';
import {CommonUtil} from '../_util/_common.util';

/**
 * This logger is prepared for typeorm developers.
 *
 * How to use?
 * [1] Config TypeOrmModule:
 *     - logger: new CustomTypeOrmLogger(),
 *     - logging: true,
 * [2] Logs produced by typeorm will be collected automatically.
 *
 * @export
 * @class CustomTypeOrmLogger
 * @implements {TypeOrmLogger}
 */
export class CustomTypeOrmLogger implements TypeOrmLogger {
  private readonly logger = new CustomLoggerService('TypeOrm');

  logQuery(query: string, parameters?: unknown[], queryRunner?: QueryRunner) {
    if (queryRunner?.data?.isCreatingLogs) {
      return;
    }
    this.logger.log(
      `${query} -- Parameters: ${CommonUtil.stringfy(parameters)}`
    );
  }

  logQueryError(
    error: string,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner
  ) {
    if (queryRunner?.data?.isCreatingLogs) {
      return;
    }
    this.logger.error(
      `${query} -- Parameters: ${CommonUtil.stringfy(parameters)} -- ${error}`
    );
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner
  ) {
    if (queryRunner?.data?.isCreatingLogs) {
      return;
    }
    this.logger.warn(
      `Time: ${time} -- Parameters: ${CommonUtil.stringfy(
        parameters
      )} -- ${query}`
    );
  }

  logMigration(message: string) {
    this.logger.log(message);
  }

  logSchemaBuild(message: string) {
    this.logger.log(message);
  }

  log(
    level: 'log' | 'info' | 'warn',
    message: string,
    queryRunner?: QueryRunner
  ) {
    if (queryRunner?.data?.isCreatingLogs) {
      return;
    }
    if (level === 'log') {
      return this.logger.log(message);
    }
    if (level === 'info') {
      return this.logger.debug(message);
    }
    if (level === 'warn') {
      return this.logger.warn(message);
    }
  }
}
