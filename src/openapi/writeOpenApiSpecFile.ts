import { existsSync, mkdirSync, writeFileSync } from 'fs';
import YAML from 'yaml';
import { ServiceMetadata } from '../metadata/types/ServiceMetadata';
import { FunctionMetadata } from '../metadata/types/FunctionMetadata';
import getTypeInfoForTypeName from '../utils/type/getTypeInfoForTypeName';
import serviceFunctionAnnotationContainer from '../decorators/service/function/serviceFunctionAnnotationContainer';
import { HttpStatusCodes } from '../constants/constants';
import isCreateFunction from '../service/crudentity/utils/isCreateFunction';
import isUpdateFunction from '../service/crudentity/utils/isUpdateFunction';
import { BACKK_ERRORS } from '../errors/backkErrors';
import isReadFunction from '../service/crudentity/utils/isReadFunction';
import isEntityTypeName from '../utils/type/isEntityTypeName';
import getServiceFunctionTestArgument from '../postman/getServiceFunctionTestArgument';
import getServiceFunctionExampleReturnValue from '../postman/getServiceFunctionExampleReturnValue';
import { ErrorDef } from '../datastore/hooks/EntityPreHook';
import LivenessCheckService from '../service/LivenessCheckService';
import ReadinessCheckService from '../service/ReadinessCheckService';
import StartupCheckService from '../service/startup/StartupCheckService';

function getErrorContent(errorDef: ErrorDef) {
  return {
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        },
        example: errorDef
      }
    }
  };
}

export function getOpenApiSpec<T>(microservice: T, servicesMetadata: ServiceMetadata[]) {
  const paths: { [path: string]: object } = {};
  let schemas: any = {};

  servicesMetadata.forEach((serviceMetadata: ServiceMetadata) => {
    serviceMetadata.functions.forEach((functionMetadata: FunctionMetadata) => {
      const ServiceClass = (microservice as any)[serviceMetadata.serviceName].constructor;
      const serviceFunctionName = `${ServiceClass.name.charAt(0).toLowerCase() +
        ServiceClass.name.slice(1)}.${functionMetadata.functionName}`;

      if (
        serviceFunctionAnnotationContainer.hasOnStartUp(ServiceClass, functionMetadata.functionName) ||
        serviceFunctionAnnotationContainer.getServiceFunctionNameToCronScheduleMap()[serviceFunctionName] ||
        serviceFunctionAnnotationContainer.isServiceFunctionAllowedForClusterInternalUse(
          ServiceClass,
          functionMetadata.functionName
        ) ||
        serviceFunctionAnnotationContainer.isServiceFunctionAllowedForServiceInternalUse(
          ServiceClass,
          functionMetadata.functionName
        )
      ) {
        return;
      }

      const requestExample = getServiceFunctionTestArgument(
        (microservice as any)[serviceMetadata.serviceName].constructor,
        (microservice as any)[serviceMetadata.serviceName].Types,
        functionMetadata.functionName,
        functionMetadata.argType,
        serviceMetadata,
        false
      );

      const { baseTypeName, isArrayType, isNull } = getTypeInfoForTypeName(functionMetadata.returnValueType);
      const path = '/' + serviceMetadata.serviceName + '.' + functionMetadata.functionName;

      const responseExample = getServiceFunctionExampleReturnValue(
        (microservice as any)[serviceMetadata.serviceName].Types,
        functionMetadata.functionName,
        baseTypeName,
        serviceMetadata,
        false
      );

      const errorResponseMap = functionMetadata.errors.reduce((errorResponseMap: any, errorDef) => {
        const statusCode = errorDef.statusCode ?? HttpStatusCodes.BAD_REQUEST;
        const description = '- ' + errorDef.errorCode + ': ' + errorDef.message;
        if (errorResponseMap[statusCode]) {
          errorResponseMap[statusCode] = {
            ...errorResponseMap[statusCode],
            description: errorResponseMap[statusCode].description + '\n' + description
          };
        } else {
          errorResponseMap[statusCode] = {
            description,
            ...getErrorContent(errorDef)
          };
        }
        return errorResponseMap;
      }, {});

      const commonErrorMap: { [key: string]: object } = {};

      if (
        isUpdateFunction(
          (microservice as any)[serviceMetadata.serviceName].constructor,
          functionMetadata.functionName
        )
      ) {
        commonErrorMap[HttpStatusCodes.CONFLICT] = {
          description:
            '1: Entity version or last modified timestamp conflict. Entity was updated before this request, please re-fetch the entity and try update again',
          ...getErrorContent(BACKK_ERRORS.ENTITY_VERSION_MISMATCH)
        };
      }

      if (
        isCreateFunction(
          (microservice as any)[serviceMetadata.serviceName].constructor,
          functionMetadata.functionName
        )
      ) {
        commonErrorMap[HttpStatusCodes.CONFLICT] = {
          description: BACKK_ERRORS.DUPLICATE_ENTITY.errorCode + ': ' + BACKK_ERRORS.DUPLICATE_ENTITY.message,
          ...getErrorContent(BACKK_ERRORS.DUPLICATE_ENTITY)
        };
      }

      if (
        isReadFunction(
          (microservice as any)[serviceMetadata.serviceName].constructor,
          functionMetadata.functionName
        ) ||
        isUpdateFunction(
          (microservice as any)[serviceMetadata.serviceName].constructor,
          functionMetadata.functionName
        )
      ) {
        commonErrorMap[HttpStatusCodes.NOT_FOUND] = {
          description: BACKK_ERRORS.ENTITY_NOT_FOUND.errorCode + ': ' + BACKK_ERRORS.ENTITY_NOT_FOUND.message,
          ...getErrorContent(BACKK_ERRORS.ENTITY_NOT_FOUND)
        };
      }

      if (functionMetadata.argType !== undefined) {
        commonErrorMap[HttpStatusCodes.BAD_REQUEST] = {
          description: BACKK_ERRORS.INVALID_ARGUMENT.errorCode + ': ' + BACKK_ERRORS.INVALID_ARGUMENT.message,
          ...getErrorContent(BACKK_ERRORS.INVALID_ARGUMENT)
        };
      }

      if (
        serviceMetadata.serviceName !== 'metadataService' &&
        !(ServiceClass instanceof LivenessCheckService) &&
        !(ServiceClass instanceof ReadinessCheckService) &&
        !(ServiceClass instanceof StartupCheckService)
      ) {
        commonErrorMap[HttpStatusCodes.UNAUTHORIZED] = {
          description:
            BACKK_ERRORS.USER_NOT_AUTHENTICATED.errorCode +
            ': ' +
            BACKK_ERRORS.USER_NOT_AUTHENTICATED.message,
          ...getErrorContent(BACKK_ERRORS.USER_NOT_AUTHENTICATED)
        };

        commonErrorMap[HttpStatusCodes.FORBIDDEN] = {
          description:
            BACKK_ERRORS.SERVICE_FUNCTION_CALL_NOT_AUTHORIZED.errorCode +
            ': ' +
            BACKK_ERRORS.SERVICE_FUNCTION_CALL_NOT_AUTHORIZED.message,
          ...getErrorContent(BACKK_ERRORS.SERVICE_FUNCTION_CALL_NOT_AUTHORIZED)
        };
      }

      if (functionMetadata.argType !== undefined) {
        commonErrorMap[HttpStatusCodes.UNPROCESSABLE_ENTITY] = {
          description:
            BACKK_ERRORS.MAX_ENTITY_COUNT_REACHED.errorCode +
            ': ' +
            BACKK_ERRORS.MAX_ENTITY_COUNT_REACHED.message,
          ...getErrorContent(BACKK_ERRORS.MAX_ENTITY_COUNT_REACHED)
        };

        commonErrorMap[HttpStatusCodes.NOT_ACCEPTABLE] = {
          description:
            BACKK_ERRORS.MISSING_SERVICE_FUNCTION_ARGUMENT.errorCode +
            ': ' +
            BACKK_ERRORS.MISSING_SERVICE_FUNCTION_ARGUMENT.message,
          ...getErrorContent(BACKK_ERRORS.MISSING_SERVICE_FUNCTION_ARGUMENT)
        };

        commonErrorMap[HttpStatusCodes.PAYLOAD_TOO_LARGE] = {
          description:
            BACKK_ERRORS.REQUEST_IS_TOO_LONG.errorCode + ': ' + BACKK_ERRORS.REQUEST_IS_TOO_LONG.message,
          ...getErrorContent(BACKK_ERRORS.REQUEST_IS_TOO_LONG)
        };
      }

      paths[path] = {
        post: {
          summary: serviceMetadata.serviceName + '.' + functionMetadata.functionName,
          ...(functionMetadata.documentation ? { description: functionMetadata.documentation } : {}),
          tags: [serviceMetadata.serviceName],
          ...(functionMetadata.argType === undefined
            ? {}
            : {
                requestBody: {
                  description: functionMetadata.argType,
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/' + functionMetadata.argType
                      },
                      example: requestExample
                    }
                  }
                }
              }),
          responses: {
            '200': {
              description: 'Successful operation',
              ...(isNull
                ? {}
                : {
                    content: {
                      'application/json': {
                        schema: {
                          ...(isArrayType
                            ? {
                                type: 'array',
                                items: {
                                  $ref: '#/components/schemas/' + baseTypeName
                                }
                              }
                            : { $ref: '#/components/schemas/' + baseTypeName })
                        },
                        example: responseExample
                      }
                    }
                  })
            },
            ...errorResponseMap,
            ...commonErrorMap
          }
        }
      };
    });

    schemas = Object.assign(
      schemas,
      Object.entries(serviceMetadata.publicTypes).reduce((schemas, [typeName, typeSpec]) => {
        const required: string[] = [];

        const properties = Object.entries(typeSpec).reduce((properties, [propertyName, propertyTypeName]) => {
          const { baseTypeName, isArrayType, isOptionalType, isNullableType } = getTypeInfoForTypeName(
            propertyTypeName
          );

          if (!isOptionalType) {
            required.push(propertyName);
          }

          const minimum: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ]?.reduce((minimum: number | undefined, validation: string) => {
            if (validation.startsWith('min(')) {
              const valueStr = validation.slice(4, -1);
              return propertyTypeName === 'integer' ? parseInt(valueStr, 10) : parseFloat(valueStr);
            }
            if (validation.startsWith('minMax(')) {
              const valueStr = validation.split(',')[0].slice(7);
              return propertyTypeName === 'integer' ? parseInt(valueStr, 10) : parseFloat(valueStr);
            }
            return minimum;
          }, undefined);

          const maximum: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ]?.reduce((maximum: number | undefined, validation: string) => {
            if (validation.startsWith('max(')) {
              const valueStr = validation.slice(4, -1);
              return propertyTypeName === 'integer' ? parseInt(valueStr, 10) : parseFloat(valueStr);
            }
            if (validation.startsWith('minMax(')) {
              const valueStr = validation.split(',')[1].slice(0, -1);
              return propertyTypeName === 'integer' ? parseInt(valueStr, 10) : parseFloat(valueStr);
            }
            return maximum;
          }, undefined);

          const multipleOf: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ]?.reduce((multipleOf: number | undefined, validation: string) => {
            if (validation.startsWith('isDivisibleBy(')) {
              const valueStr = validation.slice('isDivisibleBy('.length, -1);
              return parseInt(valueStr, 10);
            }
            return multipleOf;
          }, undefined);

          const minLength: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ].reduce((minLength: number | undefined, validation: string) => {
            if (validation.startsWith('minLength(')) {
              const valueStr = validation.slice('minLength('.length, -1);
              return parseInt(valueStr, 10);
            }
            if (validation.startsWith('length(')) {
              const valueStr = validation.split(',')[0].split('(')[1];
              return parseInt(valueStr, 10);
            }
            if (validation.startsWith('lengthAndMatches(')) {
              const valueStr = validation.split(',')[0].split('(')[1];
              return parseInt(valueStr, 10);
            }
            return minLength;
          }, undefined);

          const maxLength: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ].reduce((maxLength: number | undefined, validation: string) => {
            if (validation.startsWith('maxLength(')) {
              const valueStr = validation.slice('maxLength('.length, -1);
              return parseInt(valueStr, 10);
            }
            if (validation.startsWith('length(')) {
              const valueStr = validation.split(',')[1].slice(0, -1);
              return parseInt(valueStr, 10);
            }
            if (validation.startsWith('lengthAndMatches(')) {
              const valueStr = validation.split(',')[2];
              return parseInt(valueStr, 10);
            }
            if (validation.startsWith('maxLengthAndMatches(')) {
              const valueStr = validation.split(',')[0].split('(')[1];
              return parseInt(valueStr, 10);
            }
            return maxLength;
          }, undefined);

          const pattern: string | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ].reduce((pattern: string | undefined, validation: string) => {
            if (validation.startsWith('lengthAndMatches(')) {
              const [, , patternStart, ...rest] = validation.split(',');
              const patternStr = patternStart + (rest.length > 0 ? ',' + rest.join(',') : '');
              return patternStr.endsWith(', { each: })')
                ? patternStr.slice(2, -', { each: })'.length)
                : patternStr.slice(2, -2);
            }
            if (validation.startsWith('maxLengthAndMatches(')) {
              const [, patternStart, ...rest] = validation.split(',');
              const patternStr = (patternStart + (rest.length > 0 ? ',' + rest.join(',') : ''))
              return patternStr.endsWith(', { each: })')
                ? patternStr.slice(2, -', { each: })'.length)
                : patternStr.slice(2, -2);
            }
            return pattern;
          }, undefined);

          let format: string | undefined;
          if (baseTypeName === 'string') {
            format = (serviceMetadata.validations as any)[typeName]?.[propertyName]?.reduce(
              (format: string | undefined, validation: string) => {
                if (
                  !validation.startsWith('isString(') &&
                  !validation.startsWith('isStringOrObjectId(') &&
                  !validation.startsWith('isAnyString(') &&
                  !validation.startsWith('isArray') &&
                  validation.startsWith('is')
                ) {
                  return validation;
                }
                return format;
              },
              undefined
            );
          }

          const minItems: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ]?.reduce((minItems: number | undefined, validation: string) => {
            if (validation.startsWith('arrayMinSize(')) {
              const valueStr = validation.slice('arrayMinSize('.length, -1);
              return parseInt(valueStr, 10);
            }
            return minItems;
          }, undefined);

          const maxItems: number | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ]?.reduce((maxItems: number | undefined, validation: string) => {
            if (validation.startsWith('arrayMaxSize(')) {
              const valueStr = validation.slice('arrayMaxSize('.length, -1);
              return parseInt(valueStr, 10);
            }
            return maxItems;
          }, undefined);

          const uniqueItems: boolean | undefined = (serviceMetadata.validations as any)[typeName]?.[
            propertyName
          ]?.reduce((uniqueItems: number | undefined, validation: string) => {
            if (validation === 'arrayUnique()') {
              return true;
            }
            return uniqueItems;
          }, undefined);

          const readonly: boolean | undefined = (serviceMetadata.propertyModifiers as any)[typeName]?.[
            propertyName
          ]?.includes('readonly')
            ? true
            : undefined;

          let type;
          if (baseTypeName[0] === '(') {
            const enumValueStrs = baseTypeName.slice(1, -1).split('|');
            const enumType = enumValueStrs[0].startsWith("'") ? 'string' : 'number';

            let enumValues: string[] | number[];
            if (enumType === 'number') {
              enumValues = enumValueStrs.map((enumValueStr) => parseInt(enumValueStr, 10));
            } else {
              enumValues = enumValueStrs.map((enumValueStr) => enumValueStr.slice(1, -1));
            }

            if (isArrayType) {
              type = { type: 'array', items: { type: enumType, enum: enumValues } };
            } else {
              type = { type: enumType, enum: enumValues };
            }
          } else if (isEntityTypeName(baseTypeName)) {
            if (isArrayType) {
              type = { type: 'array', items: { $ref: '#/components/schemas/' + baseTypeName } };
            } else {
              type = { $ref: '#/components/schemas/' + baseTypeName };
            }
          } else if (baseTypeName === 'Date' || baseTypeName === 'bigint') {
            if (isArrayType) {
              type = { type: 'array', items: { type: 'string' } };
            } else {
              type = { type: 'string' };
            }
          } else {
            if (isArrayType) {
              type = { type: 'array', items: { type: baseTypeName } };
            } else {
              type = { type: baseTypeName };
            }
          }

          if (isArrayType) {
            (type as any).items = {
              ...type.items,
              ...(minimum === undefined ? {} : { minimum }),
              ...(maximum === undefined ? {} : { maximum }),
              ...(multipleOf === undefined ? {} : { multipleOf }),
              ...(minLength === undefined ? {} : { minLength }),
              ...(maxLength === undefined ? {} : { maxLength }),
              ...(propertyTypeName.startsWith('Date') ? { format: 'date-time' } : {}),
              ...(propertyName.toLowerCase().includes('password') ? { format: 'password ' } : {}),
              ...(format === undefined ? {} : { format }),
              ...(pattern === undefined ? {} : { pattern })
            };
          }

          const propertyDocumentation = (serviceMetadata.typesDocumentation as any)[typeName]?.[propertyName];
          properties[propertyName] = {
            ...(propertyDocumentation ? { description: propertyDocumentation } : {}),
            ...type,
            ...(minimum === undefined && !isArrayType ? {} : { minimum }),
            ...(maximum === undefined && !isArrayType ? {} : { maximum }),
            ...(multipleOf === undefined && !isArrayType ? {} : { multipleOf }),
            ...(minLength === undefined && !isArrayType ? {} : { minLength }),
            ...(maxLength === undefined && !isArrayType ? {} : { maxLength }),
            ...(isNullableType ? { nullable: isNullableType } : {}),
            ...(propertyTypeName.startsWith('Date') && !isArrayType ? { format: 'date-time' } : {}),
            ...(propertyName.toLowerCase().includes('password') && !isArrayType
              ? { format: 'password ' }
              : {}),
            ...(format === undefined && !isArrayType ? {} : { format }),
            ...(pattern === undefined && !isArrayType ? {} : { pattern }),
            ...(minItems === undefined ? {} : { minItems }),
            ...(maxItems === undefined ? {} : { maxItems }),
            ...(uniqueItems === undefined ? {} : { uniqueItems }),
            ...(readonly === undefined ? {} : { readonly })
          };

          return properties;
        }, {} as { [key: string]: object });

        schemas[typeName] = {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {})
        };

        return schemas;
      }, {} as { [key: string]: object })
    );
  });

  const cwd = process.cwd();
  const appName = cwd.split('/').reverse()[0];

  return {
    openapi: '3.0.0',
    info: {
      title: appName + ' API',
      description: process.env.MICROSERVICE_DESCRIPTION ?? '',
      version: process.env.npm_package_version,
      ...(process.env.API_TERMS_OF_SERVICE_URL
        ? { termsOfService: process.env.API_TERMS_OF_SERVICE_URL }
        : {}),
      contact: {
        ...(process.env.API_CONTACT_NAME ? { name: process.env.API_CONTACT_NAME } : {}),
        ...(process.env.API_CONTACT_EMAIL ? { email: process.env.API_CONTACT_EMAIL } : {}),
        ...(process.env.API_CONTACT_URL ? { url: process.env.API_CONTACT_URL } : {})
      },
      license: {
        ...(process.env.API_LICENSE_NAME ? { name: process.env.API_LICENSE_NAME } : {}),
        ...(process.env.API_LICENSE_URL ? { url: process.env.API_LICENSE_URL } : {})
      },
      ...(process.env.API_EXTERNAL_DOCS_URL
        ? {
            externalDocs: {
              description: 'Find more about ' + appName + ' API',
              url: process.env.API_EXTERNAL_DOCS_URL
            }
          }
        : {})
    },
    servers: [
      process.env.NODE_ENV === 'development'
        ? {
            url: `http://localhost:${process.env.HTTP_SERVER_PORT ?? 3000}`,
            description: 'Local development server'
          }
        : {
            url: `https://${process.env.API_GW_FQDN}${process.env.API_GW_PATH}`,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            description: process.env.NODE_ENV!.toUpperCase() + process.env.NODE_ENV!.slice(1) + ' server'
          }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas
    },
    security: [{ bearerAuth: [] }],
    paths
  };
}

export default function writeOpenApiSpecFile<T>(microservice: T, servicesMetadata: ServiceMetadata[]) {
  const openApiSpec = getOpenApiSpec(microservice, servicesMetadata);

  const cwd = process.cwd();

  if (!existsSync(cwd + '/openapi')) {
    mkdirSync(cwd + '/openapi');
  }

  writeFileSync(process.cwd() + '/openapi/openApiSpec.yaml', YAML.stringify(openApiSpec));
}
